import Queue from 'bull';

const myQueue = new Queue('scan', 'redis://127.0.0.1:6379')

// Get all jobs and filter by job data
myQueue.getJobs().then((jobs) => {
    console.log(`There are ${jobs.length} jobs in the queue.`)
});

myQueue.getActive().then((jobs) => {
    console.log(`There are ${jobs.length} active jobs in the queue.`)
});

myQueue.getWaiting().then((jobs) => {
    console.log(`There are ${jobs.length} waiting jobs in the queue.`)
});

myQueue.getDelayed().then((jobs) => {
    console.log(`There are ${jobs.length} delayed jobs in the queue.`)
});

myQueue.getCompleted().then((jobs) => {
    console.log(`There are ${jobs.length} completed jobs in the queue.`)
});

myQueue.getFailed().then((jobs) => {
    console.log(`There are ${jobs.length} failed jobs in the queue.`)
    jobs.forEach((job) => console.log(job.failedReason));
});