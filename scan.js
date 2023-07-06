import { ethers } from 'ethers'
import config from './config.js'
import { buildCollectionOffer, buildItemOffer, postItemOffer, signOffer, postCriteriaOffer, getFloorAndOffer } from './utils/openSea.js'
import { getTrimmedPriceInWei } from './utils.js'

const { provider, privateKey } = config
const signer = new ethers.Wallet(privateKey, provider)

const WETH_ADDRESS = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';

const ERC20_ABI = [
    // Some details about the token
    "function name() view returns (string)",
    "function symbol() view returns (string)",

    // Get the account balance
    "function balanceOf(address) view returns (uint)",
];

const wethContract = new ethers.Contract(WETH_ADDRESS, ERC20_ABI, signer);

async function getWETHBalance() {
    const balance = await wethContract.balanceOf(signer.address);
    console.log(`WETH Balance: ${ethers.utils.formatEther(balance)}`);
    return balance;
}

const OFFER_EXPIRATION_SECONDS = 830

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

let schema = process.argv[5]
if (!schema) {
    schema = 'ERC721' // ERC721 schema default
}

let token = process.argv[6]
if (!token) {
    token = null
}

async function main() {
    const maxAttempts = 5; // Maximum number of attempts
    let attempt = 0;

    while(attempt < maxAttempts) {
        try {
            console.log(`Attempt ${attempt + 1} of ${maxAttempts}...`)
            const { highestOffer, floorPrice, highestOfferer, collectionName, collectionAddress } = await getFloorAndOffer(slug, schema, token);

            console.log(`Collection: ${collectionName}`);
            console.log(`Schema: ${schema}`);
            console.log(`Margin: ${margin}`);
            console.log(`Bid Increment: ${increment}`);

            console.log(`highestOffer: ${highestOffer}`);
            console.log(`floorPrice: ${floorPrice}`);

            let wethBalance = await getWETHBalance();

            const priceWei = getTrimmedPriceInWei(highestOffer, increment);
            const price = ethers.BigNumber.from(priceWei) / 10 ** 18;

            if (priceWei > wethBalance) {
                console.log('Not enough WETH to post offer.');
                return;
            }

            if (highestOfferer === signer.address.toLowerCase()) {
                console.log('You are the highest offerer. Not posting.');
                return;
            }
        
            if (highestOffer * (1 + increment) > floorPrice * (1 - margin)) {
                console.log('Offer too close to floor. Not posting.');
                return;
            }
            
            if (schema === 'ERC721') {
                
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
                return;
            } else if (schema === 'ERC1155') {

                console.log(`Building offer for ${price}...`);
                const itemOffer = await buildItemOffer({
                    assetContractAddress: collectionAddress,
                    tokenId: token,
                    quantity: 1,
                    priceWei: priceWei,
                    expirationSeconds: BigInt(OFFER_EXPIRATION_SECONDS),
                })
                console.log(`Signing offer...`)
                const itemSignature = await signOffer(signer, itemOffer);
                console.log(`Posting offer...`)
                const itemResponse = await postItemOffer(itemOffer, itemSignature);
                if (itemResponse.error) {
                    throw new Error(`Error posting item offer: ${JSON.stringify(itemResponse.error)}`);
                }
                const itemOrderHash = itemResponse.order.order_hash;
                console.log(`Item offer posted! Order Hash: ${itemOrderHash}`);
                return;

            } else {
                console.error('Invalid schema provided. Exiting...');
                return;
            }

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