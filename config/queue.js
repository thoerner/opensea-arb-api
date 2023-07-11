import { Queue, Worker } from 'bullmq'
import { spawn } from 'child_process'
import { redisClient } from './redis.js'

export const scanQueue = new Queue('scan', { connection: redisClient })
scanQueue.obliterate({ force: true })

const worker = new Worker('scan', async (job) => {
    const { collectionSlug, margin, increment, schema, token } = job.data;

    return new Promise((resolve, reject) => {
        const process = spawn('node', ['./scan.js', collectionSlug, margin, increment, schema, token]);

        process.stdout.on('data', (data) => {
            console.log(`stdout: ${data}`);
        });

        process.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
        });

        process.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`process exited with code ${code}`));
            } else {
                resolve();
            }
        });
    });

}, { connection: redisClient });

worker.on('completed', (job) => {
    console.log(`Scan of ${job.data.collectionSlug} completed`);
})

worker.on('failed', (job, err) => {
    console.log(`${job.data.collectionSlug} scan failed with ${err.message}`);
})

export const addRepeatableJob = async (collectionSlug, margin, increment, schema, token, interval) => {
    let job
    if (collectionSlug.S) {
        job = await scanQueue.add(
            'nft-scan',
            {
                collectionSlug: collectionSlug.S,
                margin: margin.N,
                increment: increment.N,
                schema: schema.S,
                token
            }, {
            jobId: collectionSlug.S,
            repeat: {
                every: interval
            }
        });
    } else {
        job = await scanQueue.add(
            'nft-scan',
            {
                collectionSlug,
                margin,
                increment,
                schema,
                token
            }, {
            jobId: collectionSlug,
            repeat: {
                every: interval
            }
        });
    }

    return job
}

export const addJob = async (collectionSlug, margin, increment, schema, token) => {
    console.log(`Adding job for ${collectionSlug.S}`)
    const job = await scanQueue.add(
        'nft-scan',
        {
            collectionSlug: collectionSlug.S,
            margin: margin.N,
            increment: increment.N,
            schema: schema.S,
            token
        }, {
        jobId: collectionSlug.S,
    });

    return job
}

const getRepeatableJobs = async () => {
    const repeatableJobs = await scanQueue.getRepeatableJobs()
    return repeatableJobs
}

export const removeJobById = async (id) => {
    const jobs = await getRepeatableJobs()
    const key = jobs.find(job => job.id === id).key
    console.log(key)
    await scanQueue.removeRepeatableByKey(key)
}