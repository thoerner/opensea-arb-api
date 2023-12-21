import { getCollection, getNfts, getTraits, getStats } from "../utils/openSea.js"

export const getCollectionInfo = async (req, res) => {
    const collectionSlug = req.params.collectionSlug

    const collection = await getCollection(collectionSlug)
    const traits = await getTraits(collectionSlug)
    const stats = await getStats(collectionSlug)

    const name = collection.name
    const imageUrl = collection.image_url
    const creatorFee = {
        isEnforced: collection.fees[1].required,
        fee: collection.fees[1].fee
    }
    const { nfts, schema } = await getNfts(collectionSlug)

    if (schema === 'erc1155') {
        res.send({ name, traits, stats, schema, creatorFee, imageUrl, nfts })
        return
    } else {
        res.send({ name, traits, stats, schema, creatorFee, imageUrl })
        return
    }
}