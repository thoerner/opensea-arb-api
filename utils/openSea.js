import { postRequest, getRequest, genSalt } from '../utils.js'
import config from '../config.js'

const {apiV1Url, apiV2Url, sigTypes, offerer, wethAddress, conduitKey, protocolAddress, seaportContractAddress, domain } = config



const getFee = (priceWei, feeBasisPoints, recipient) => {
    const fee = (priceWei * feeBasisPoints) / BigInt(10000)
    if (fee <= 0) {
        return null
    }
    return {
        itemType: 1,
        token: wethAddress,
        identifierOrCriteria: 0,
        startAmount: fee.toString(),
        endAmount: fee.toString(),
        recipient,
    }
}

const extractFeesApi = (feesObject, priceWei) => {
    const fees = []
    for (const [_category, categoryFees] of Object.entries(feesObject)) {
        for (const [address, basisPoints] of Object.entries(categoryFees)) {
            const fee = getFee(priceWei, BigInt(basisPoints), address)
            if (fee) {
                fees.push(fee)
            }
        }
    }
    return fees
}

const getCriteriaFees = async (collectionSlug, priceWei) => {
    const response = await getRequest(apiV1Url + `/collection/${collectionSlug}`)
    const feesObject = response.collection.fees
    return extractFeesApi(feesObject, priceWei)    
}

const getCriteriaConsideration = async (criteriaFees, collectionSlug, priceWei) => {
    const fees = [
        ...criteriaFees,
        ...(await getCriteriaFees(collectionSlug, priceWei)),
    ]
    return fees.filter(fee => fee !== null)
}

const getOffer = (priceWei) => {
    return [
        {
            itemType: 1,
            token: wethAddress,
            identifierOrCriteria: 0,
            startAmount: priceWei.toString(),
            endAmount: priceWei.toString(),
        }
    ]
}

const getItemTokenConsideration = async (
    assetContractAddress,
    tokenId,
    quantity,
) => {
    return {
        itemType: 2,
        token: assetContractAddress,
        identifierOrCriteria: tokenId,
        startAmount: quantity.toString(),
        endAmount: quantity.toString(),
        recipient: offerer,
    }
}

const getItemFees = async (
    assetContractAddress,
    tokenId,
    priceWei,
) => {
    const asset = await getRequest(apiV1Url + `/asset/${assetContractAddress}/${tokenId}`)
    const feesObject = asset.collection.fees
    return extractFeesApi(feesObject, priceWei)
}

const getItemConsideration = async (
    assetContractAddress,
    tokenId,
    quantity,
    priceWei,
) => {
    const fees = [
        await getItemTokenConsideration(assetContractAddress, tokenId, quantity),
        ...(await getItemFees(assetContractAddress, tokenId, priceWei)),
    ]

    return fees
}

const buildItemOffer = async (offerSpecification) => {
    const { assetContractAddress, tokenId, quantity, priceWei, expirationSeconds } = offerSpecification

    const now = BigInt(Math.floor(Date.now() / 1000))
    const startTime = now.toString()
    const endTime = (now + BigInt(expirationSeconds)).toString()
    const consideration = await getItemConsideration(
        assetContractAddress,
        tokenId,
        quantity,
        priceWei,
    )

    const offer = {
        offerer,
        offer: getOffer(priceWei),
        consideration,
        startTime,
        endTime,
        orderType: 0,
        zone: "0x0000000000000000000000000000000000000000",
        zoneHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
        salt: genSalt(38),
        conduitKey,
        totalOriginalConsiderationItems: consideration.length.toString(),
        counter: 0
    }

    return offer
}

const postItemOffer = async (offer, signature) => {
    const payload = {
        parameters: offer,
        signature,
        protocol_address: protocolAddress
    }
    return await postRequest(apiV2Url + `/orders/ethereum/seaport/offers`, payload)
}

const buildOfferParams = async (slug, quantity) => {
    const buildPayload = {
        quantity,
        offer_protection_enabled: true,
        offerer,
        criteria: { collection: { slug } },
        protocol_address: protocolAddress
    }
    return postRequest(apiV2Url + `/offers/build`, buildPayload)
}

const buildCollectionOffer = async (offerSpecification) => {

    const { collectionSlug, quantity, priceWei, expirationSeconds } = offerSpecification

    const now = BigInt(Math.floor(Date.now() / 1000))
    const startTime = now.toString()
    const endTime = (now + BigInt(expirationSeconds)).toString()
    const rawOfferParams = await buildOfferParams(collectionSlug, quantity)
    const offerParams = rawOfferParams.partialParameters
    const consideration = await getCriteriaConsideration(
        offerParams.consideration,
        collectionSlug,
        priceWei,
    )

    const offer = {
        offerer,
        offer: getOffer(priceWei),
        consideration,
        startTime,
        endTime,
        orderType: 2,
        zone: offerParams.zone,
        zoneHash: offerParams.zoneHash,
        salt: genSalt(38),
        conduitKey,
        totalOriginalConsiderationItems: consideration.length.toString(),
        counter: 0,
    }

    return offer
}

const signOffer = async (signer, offer) => {
    return await signer._signTypedData(domain, sigTypes, offer)
}

const postCriteriaOffer = async (collectionSlug, offer, signature) => {
    const offerPayload = {
        criteria: {
            collection: {
                slug: collectionSlug
            }
        },
        protocol_data: {
            parameters: offer,
            signature,
        },
        protocol_address: seaportContractAddress
    }
    return postRequest(apiV2Url + `/offers`, offerPayload)
}

const getCollectionOffers = async (slug) => {
    return getRequest(apiV2Url + `/offers/collection/${slug}`)
}

const getAllListings = async (slug, next) => {
    return getRequest(apiV2Url + `/listings/collection/${slug}/all?next=${next}`)
}

const getTraits = async (slug) => {
    const collection = await getCollection(slug)
    return collection.collection.traits
}

const getNfts = async (slug) => {
    const response = await getRequest(apiV2Url + `/collection/${slug}/nfts`)
    let count = response.nfts.count
    return {
        count,
        nfts: response.nfts
    }
}

const getFloorAndOffer = async (slug) => {
    const offerParams = await getCollectionOffers(slug)
    const collectionName = offerParams.offers[0].criteria.collection.slug
    const quantity = offerParams.offers[0].protocol_data.parameters.consideration[0].startAmount
    const highestOffer = offerParams.offers[0].protocol_data.parameters.offer[0].startAmount / (10 ** 18) / quantity
    const highestOfferer = offerParams.offers[0].protocol_data.parameters.offerer
    const collectionAddress = offerParams.offers[0].criteria.contract.address
    
    let listing_prices = []
    
    let listings
    let next = null
    
    const getListings = async (next) => {
        // console.log(slug, next)
        listings = await getAllListings(slug, next)
        for (let i = 0; i < listings.listings.length; i++) {
            listing_prices.push(listings.listings[i].price.current.value / (10 ** 18))
        }   
    }
    
    await getListings('')
    
    while (listings.next !== null && listings.next !== undefined) {
        next = listings.next
        await getListings(next)
    }
    
    const getLowestListing = () => {
        return Math.min(...listing_prices)
    }
    
    let floorPrice = getLowestListing()
    
    return { highestOffer, floorPrice, highestOfferer, collectionName, collectionAddress }
}

const getCollectionInfo = async (collectionSlug) => {
    const response = await getRequest(apiV1Url + `/collection/${collectionSlug}`)
    return response.collection
}

const getCollection = async (slug) => {
    const response = await getCollectionInfo(slug)
    return response
}

export {
    buildCollectionOffer,
    buildItemOffer,
    postItemOffer,
    signOffer,
    postCriteriaOffer,
    getFloorAndOffer,
    getTraits,
    getCollection,
    getNfts
}