import { ethers } from 'ethers'
import dotenv from 'dotenv'
import config from './config.js'
import { buildCollectionOffer, signOffer, postCriteriaOffer, getFloorAndOffer, getCollectionName } from './openSea.js'
import { getTrimmedPriceInWei } from './utils.js'

dotenv.config()

const { provider, privateKey } = config
const signer = new ethers.Wallet(privateKey, provider)

const slug = process.argv[2]
if (!slug) {
    console.error('No collection slug provided')
    process.exit(1)
}

const margin = Number(process.argv[3])
const increment = Number(process.argv[4])

async function main() {

    console.log(`Collection: ${await getCollectionName(slug)}`)
    console.log(`Margin: ${margin}`)
    console.log(`Bid Increment: ${increment}`)
    
    const { highestOffer, floorPrice } = await getFloorAndOffer(slug)

    console.log(`highestOffer: ${highestOffer}`)
    console.log(`floorPrice: ${floorPrice}`)
    
    if (highestOffer * (1 + increment) > floorPrice * (1 - margin)) {
        console.log('Offer too close to floor. Not posting.')
        return
    }

    const priceWei = getTrimmedPriceInWei(highestOffer, increment)
    const price = ethers.BigNumber.from(priceWei) / 10 ** 18

    console.log(`Building offer for ${price}...`)
    const collectionOffer = await buildCollectionOffer({
        collectionSlug: slug,
        quantity: 1,
        priceWei: priceWei,
        expirationSeconds: BigInt(830),
    })

    console.log(`Signing offer...`)
    const collectionSignature = await signOffer(signer, collectionOffer)

    console.log(`Posting offer...`)
    const collectionResponse = await postCriteriaOffer(
        slug,
        collectionOffer,
        collectionSignature,
    )

    if (collectionResponse.error) {
        console.error(`Error posting collection offer: ${JSON.stringify(collectionResponse.error)}`)
        return
    }
    console.log(
        `Collection offer posted! Order Hash: ${collectionResponse.order_hash}`,
    )
}

console.log('Starting... looking for new offers...')
main().catch(error => console.error(error));

// run it every 840 seconds
setInterval(() => {
    console.log('Looking to post a new offer...');
    main().catch(error => console.error(error));
}, 840000);