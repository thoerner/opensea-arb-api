import { getCollection, getNfts } from "../utils/openSea.js"

export const getCollectionInfo = async (req, res) => {
    const collectionSlug = req.params.collectionSlug

    const collection = await getCollection(collectionSlug)
    const contractInfo = collection.primary_asset_contracts[0]
    const name = collection.name
    const traits = collection.traits
    const stats = collection.stats
    const schema = collection.primary_asset_contracts[0].schema_name
    const imageUrl = collection.image_url
    const creatorFee = {
        isEnforced: collection.is_creator_fees_enforced,
        fee: collection.dev_seller_fee_basis_points
    }

    if (schema === 'ERC1155') {
        const { count, nfts } = await getNfts(collectionSlug)
        res.send({ contractInfo, name, traits, stats, schema, creatorFee, imageUrl, nfts })
        return
    } else {
        res.send({ contractInfo, name, traits, stats, schema, creatorFee, imageUrl })
        return
    }
}