import { DynamoDBClient, ScanCommand, PutItemCommand, DeleteItemCommand } from '@aws-sdk/client-dynamodb'
import dotenv from 'dotenv'
dotenv.config()

const TableName = process.env.TABLE_NAME

export const dbClient = new DynamoDBClient({ region: 'us-east-1' })

export const getAllItems = async () => {
    const command = new ScanCommand({ TableName });

    const data = await dbClient.send(command)
    return data.Items
}

export const getItem = async (slug, token) => {
    const command = new ScanCommand({
        TableName,
        FilterExpression: 'slug = :slug AND #t = :token',
        ExpressionAttributeNames: {
            '#t': 'token',
        },
        ExpressionAttributeValues: {
            ':slug': { S: slug },
            ':token': { S: token.toString() }
        }
    });

    const data = await dbClient.send(command)
    return data.Items[0]
}


export const putItem = async (item) => {
    const putCommand = new PutItemCommand({
        TableName,
        Item: item
    })

    try {
        await dbClient.send(putCommand)
        return { success: true }
    } catch (err) {
        console.error(`Error putting item ${item.slug.S}: ${err}`)
        return { error: err }
    }
}

export const deleteItem = async (slug, token) => {
    const deleteCommand = new DeleteItemCommand({
        TableName,
        Key: {
            slug: { S: slug },
            token: { S: token.toString() }
        }
    })

    try {
        await dbClient.send(deleteCommand)
        return { success: true }
    } catch (err) {
        console.error(`Error deleting item ${slug}: ${err}`)
        return { error: err }
    }
}