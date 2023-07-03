import Queue from 'bull'

export const scanQueue = new Queue('scan', 'redis://127.0.0.1:6379')
