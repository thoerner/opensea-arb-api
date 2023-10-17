import { Queue, Worker } from 'bullmq'
import { spawn } from 'child_process'
import { redisClient } from './redis.js'

export const scanQueue = new Queue('scan', { connection: redisClient })
scanQueue.obliterate({ force: true })

function spawnWorker (jobData) {
    const { collectionSlug, margin, increment, schema, token, isCollectionOffer } = jobData;

    return new Promise((resolve, reject) => {
        const child = spawn('node', ['./scan.js', collectionSlug, margin, increment, schema, token, isCollectionOffer]);

        child.stdout.on('data', (data) => {
            console.log(`stdout: ${data}`);
        });

        child.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
        });

        child.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`process exited with code ${code}`));
            } else {
                resolve();
            }
        });
    });
}

const worker = new Worker('scan', async (job) => {
    return spawnWorker(job.data);
}, { connection: redisClient });

worker.on('completed', (job) => {
    console.log(`Scan of ${job.data.collectionSlug} completed`);
})

worker.on('failed', (job, err) => {
    console.log(`${job.data.collectionSlug} scan failed with ${err.message}`);
})

export const addRepeatableJob = async (collectionSlug, margin, increment, schema, token, superblaster, isCollectionOffer) => {
    let job
    let interval
    if (collectionSlug.S) {
        interval = superblaster.BOOL ? 30 * 1000 : 3 * 60 * 1000 // 30 seconds for superblaster, 3 minutes for everyone else
        job = await scanQueue.add(
            'nft-scan',
            {
                collectionSlug: collectionSlug.S,
                margin: margin.N,
                increment: increment.N,
                schema: schema.S,
                token: token.S,
                isCollectionOffer: isCollectionOffer.BOOL
            }, {
            jobId: `${collectionSlug.S}-${token.S}`,
            repeat: {
                every: interval
            }
        });
    } else {
        interval = superblaster ? 30 * 1000 : 3 * 60 * 1000 // 30 seconds for superblaster, 3 minutes for everyone else
        job = await scanQueue.add(
            'nft-scan',
            {
                collectionSlug,
                margin,
                increment,
                schema,
                token,
                isCollectionOffer
            }, {
            jobId: `${collectionSlug}-${token}`,
            repeat: {
                every: interval
            }
        });
    }
    spawnWorker(job.data)
    return job
}

const getRepeatableJobs = async () => {
    const repeatableJobs = await scanQueue.getRepeatableJobs()
    return repeatableJobs
}

export const removeJobById = async (id) => {
    const jobs = await getRepeatableJobs()
    const key = jobs.find(job => job.id === id).key
    console.log(`Removing job with key ${key} from queue`)
    await scanQueue.removeRepeatableByKey(key)
}

setInterval(async () => {
    await scanQueue.clean(3600 * 1000, 'completed');
}, 24 * 3600 * 1000); // clean completed jobs every 24 hours