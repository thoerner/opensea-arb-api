import { ethers } from 'ethers'
import config from './config.js'
import { buildCollectionOffer, buildTraitCollectionOffer, buildItemOffer, postItemOffer, signOffer, postCriteriaOffer, getFloorAndOffer, getCollection, getStats } from './utils/openSea.js'
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
if (!slug || slug === 'undefined') {
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
    schema = 'erc721' // ERC721 schema default
}

let token = process.argv[6]
if (!token) {
    token = null
}

let isCollectionOffer = process.argv[7]
if (!isCollectionOffer) {
    isCollectionOffer = false
} else {
    isCollectionOffer = isCollectionOffer === 'true'
}

let isTraitOffer = process.argv[8]
if (!isTraitOffer) {
    isTraitOffer = false
} else {
    isTraitOffer = isTraitOffer === 'true'
}

let trait = process.argv[9]
if (!trait) {
    trait = null
}

async function main() {
    const maxAttempts = 5; // Maximum number of attempts
    let attempt = 0;

    while(attempt < maxAttempts) {
        try {
            const { highestOffer, floorPrice: erc1155FloorPrice, highestOfferer, collectionName, collectionAddress } = await getFloorAndOffer(slug, token, isCollectionOffer);
            const stats = await getStats(slug);

            let floorPrice = stats.total.floor_price;
            if (!isCollectionOffer) {
                if (schema === "erc1155") {
                    floorPrice = erc1155FloorPrice;
                }
            }

            console.log(`Collection: ${collectionName}`);
            console.log(`Schema: ${schema}`);
            console.log(`Offer Type:${isCollectionOffer === true ? ' Collection' : isTraitOffer === true? ' Trait' : ' Item'}`);
            console.log(`Margin: ${margin}`);

            console.log(`highestOffer: ${highestOffer}`);
            console.log(`floorPrice: ${floorPrice}`);

            let wethBalance = await getWETHBalance();

            const offerWei = getTrimmedPriceInWei(highestOffer + 0.0001);
            const offerAmount = ethers.BigNumber.from(offerWei) / 10 ** 18;

            if (offerWei > wethBalance) {
                console.log('Not enough WETH to post offer.');
                return;
            }

            if (highestOfferer === signer.address.toLowerCase()) {
                console.log('You are the highest offerer. Not posting.');
                return;
            }
        
            if (highestOffer + 0.0001 > floorPrice * (1 - margin)) {
                console.log('Offer too close to floor. Not posting.');
                return;
            }
            
            if (isTraitOffer) {
                console.log(`Building offer for ${offerAmount}...`);
                const traitOffer = await buildTraitCollectionOffer({
                    collectionSlug: slug,
                    quantity: 1,
                    priceWei: offerWei,
                    expirationSeconds: BigInt(OFFER_EXPIRATION_SECONDS),
                    trait: trait,
                });

                console.log(`Signing offer...`);
                const traitSignature = await signOffer(signer, traitOffer);

                console.log(`Posting offer...`);
                const traitResponse = await postCriteriaOffer(
                    slug,
                    traitOffer,
                    traitSignature,
                );

                if (traitResponse.error) {
                    throw new Error(`Error posting trait offer: ${JSON.stringify(traitResponse.error)}`);
                }

                console.log(
                    `Trait offer posted! Order Hash: ${traitResponse.order_hash}`,
                );
                return;
            } else if (isCollectionOffer) {
                
                console.log(`Building offer for ${offerAmount}...`);
                const collectionOffer = await buildCollectionOffer({
                    collectionSlug: slug,
                    quantity: 1,
                    priceWei: offerWei,
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
            } else {

                console.log(`Building offer for ${offerAmount}...`);
                const itemOffer = await buildItemOffer({
                    assetContractAddress: collectionAddress,
                    tokenId: token,
                    quantity: 1,
                    priceWei: offerWei,
                    expirationSeconds: BigInt(OFFER_EXPIRATION_SECONDS),
                    slug: slug,
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


console.log(`Starting scan for ${slug}...`)
main().catch(error => console.error(error));