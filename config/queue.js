import Queue from 'bull'
import { spawn } from 'child_process'
import { v4 as uuidv4 } from 'uuid'

export const scanQueue = new Queue('scan', 'redis://127.0.0.1:6379')

export const registerProcessor = (jobType) => {
    scanQueue.process(jobType, 1, (job, done) => {
        const { collectionSlug, margin, increment, schema, token } = job.data;

        const worker = spawn('node', ['./scan.js', collectionSlug, margin, increment, schema, token]);

        worker.stdout.on('data', (data) => {
            console.log(`stdout: ${data}`);
        });

        worker.stderr.on('data', (data) => {
            console.error(`stderr: ${data}`);
        });

        worker.on('close', (code) => {
            console.log(`${collectionSlug} scan completed with code: ${code}`);
            done();
        });

        worker.on('error', (err) => {
            console.error(`${collectionSlug} scan errored with: ${err}`);
            done(err);
        });

        job.on('completed', async () => {

        })
    });
}

export const addRepeatableJob = async (collectionSlug, margin, increment, schema, token, interval) => {
    const job = await scanQueue.add(
        collectionSlug.S,
        {
            collectionSlug: collectionSlug.S,
            margin: margin.N,
            increment: increment.N,
            schema: schema.S,
            token
        }, {
        jobId: uuidv4(),
        repeat: {
            every: interval
        }
    });

    return job
}

export const addJob = async (collectionSlug, margin, increment, schema, token) => {
    console.log(`Adding job for ${collectionSlug.S}`)
    const job = await scanQueue.add(
        collectionSlug.S,
        {
            collectionSlug: collectionSlug.S,
            margin: margin.N,
            increment: increment.N,
            schema: schema.S,
            token
        }, {
        jobId: uuidv4(),
    });

    return job
}
