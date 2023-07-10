import Redis from 'ioredis'

export const redisClient = new Redis({ maxRetriesPerRequest: null })

redisClient.on('error', (err) => {
    console.log('Redis error: ', err)
})

redisClient.on('connect', () => {
    console.log('Redis client connected')
})