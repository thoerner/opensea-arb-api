import { ethers } from 'ethers'
import config from './config.js'
import { buildCollectionOffer, signOffer, postCriteriaOffer, getFloorAndOffer, getCollectionName } from './openSea.js'
import { getTrimmedPriceInWei } from './utils.js'

const { provider, privateKey } = config
const signer = new ethers.Wallet(privateKey, provider)

const OFFER_EXPIRATION_SECONDS = 830
const OFFER_INTERVAL_SECONDS = 180

const slug = process.argv[2]
if (!slug) {
    console.error('No collection slug provided')
    process.exit(1)
}

let margin = Number(process.argv[3])
if (!margin) {
    margin = 0.15 // 15% margin default
}

let increment = Number(process.argv[4])
if (!increment) {
    increment = 0.01 // 1% increment default
}

async function main() {
    const maxAttempts = 5; // Maximum number of attempts
    let attempt = 0;

    while(attempt < maxAttempts) {
        try {
            console.log(`Collection: ${await getCollectionName(slug)}`);
            console.log(`Margin: ${margin}`);
            console.log(`Bid Increment: ${increment}`);

            const { highestOffer, floorPrice } = await getFloorAndOffer(slug);

            console.log(`highestOffer: ${highestOffer}`);
            console.log(`floorPrice: ${floorPrice}`);
        
            if (highestOffer * (1 + increment) > floorPrice * (1 - margin)) {
                console.log('Offer too close to floor. Not posting.');
                return;
            }

            const priceWei = getTrimmedPriceInWei(highestOffer, increment);
            const price = ethers.BigNumber.from(priceWei) / 10 ** 18;

            console.log(`Building offer for ${price}...`);
            const collectionOffer = await buildCollectionOffer({
                collectionSlug: slug,
                quantity: 1,
                priceWei: priceWei,
                expirationSeconds: BigInt(OFFER_EXPIRATION_SECONDS),
            });

            console.log(`Signing offer...`);
            const collectionSignature = await signOffer(signer, collectionOffer);

            console.log(`Posting offer...`);
            const collectionResponse = await postCriteriaOffer(
                slug,
                collectionOffer,
                collectionSignature,
            );

            if (collectionResponse.error) {
                throw new Error(`Error posting collection offer: ${JSON.stringify(collectionResponse.error)}`);
            }

            console.log(
                `Collection offer posted! Order Hash: ${collectionResponse.order_hash}`,
            );
            break; // Break loop on success

        } catch (error) {
            console.error(error);
            attempt++;
            if(attempt >= maxAttempts) {
                console.error('Maximum attempts reached. Exiting...');
                return;
            }
        }
    }
}


console.log('Starting... looking for new offers...')
main().catch(error => console.error(error));

setInterval(() => {
    console.log('Looking to post a new offer...');
    main().catch(error => console.error(error));
}, OFFER_INTERVAL_SECONDS * 1000);