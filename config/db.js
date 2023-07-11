import { DynamoDBClient, ScanCommand, PutItemCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb'
import dotenv from 'dotenv'
dotenv.config()

export const dbClient = new DynamoDBClient({ region: 'us-east-1' })

export const getAllItems = async () => {
    const command = new ScanCommand({
        TableName: 'arb_anderson_scans'
    });

    const data = await dbClient.send(command)
    return data.Items
}

export const getItem = async (slug) => {
    const command = new ScanCommand({
        TableName: 'arb_anderson_scans',
        FilterExpression: 'slug = :slug',
        ExpressionAttributeValues: {
            ':slug': { S: slug }
        }
    });

    const data = await dbClient.send(command)
    return data.Items[0]
}

export const putItem = async (item) => {
    const putCommand = new PutItemCommand({
        TableName: 'arb_anderson_scans',
        Item: item
      });
    
    try {
        await dbClient.send(putCommand)
        return { success: true }
    } catch (err) {
        console.error(`Error putting item ${item.slug.S}: ${err}`)
        return { error: err }
    }
}

export const deleteItem = async (slug) => {
    const deleteCommand = new DeleteItemCommand({
        TableName: 'arb_anderson_scans',
        Key: {
          slug: { S: slug }
        }
      });
    
    try {
        await dbClient.send(deleteCommand)
        return { success: true }
    } catch (err) {
        console.error(`Error deleting item ${slug}: ${err}`)
        return { error: err }
    }
}