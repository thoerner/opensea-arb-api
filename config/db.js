import { DynamoDBClient } from '@aws-sdk/client-dynamodb'

export const dbClient = new DynamoDBClient({ region: 'us-east-1' })
