import { postRequest, getRequest, genSalt } from '../utils.js'
import config from '../config.js'

const { apiV1Url, apiV2Url, sigTypes, offerer, wethAddress, conduitKey, protocolAddress, seaportContractAddress, domain } = config

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

const buildTraitOfferParams = async (slug, quantity, trait) => {
    const buildPayload = {
        quantity,
        offer_protection_enabled: true,
        offerer,
        criteria: { 
            collection: { slug },
            trait
        },
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

const buildTraitCollectionOffer = async (offerSpecification) => {

    const { collectionSlug, quantity, priceWei, expirationSeconds, trait } = offerSpecification

    const now = BigInt(Math.floor(Date.now() / 1000))
    const startTime = now.toString()
    const endTime = (now + BigInt(expirationSeconds)).toString()
    const rawOfferParams = await buildTraitOfferParams(collectionSlug, quantity, trait)
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

const retrieveListings = async (address, tokenId) => {
    const response = await getRequest(apiV2Url + `/orders/ethereum/seaport/listings?asset_contract_address=${address}&token_ids=${tokenId}&order_by=eth_price&order_direction=asc`)
    return response.orders
}

const retrieveOffers = async (address, tokenId) => {
    const response = await getRequest(apiV2Url + `/orders/ethereum/seaport/offers?asset_contract_address=${address}&token_ids=${tokenId}&order_by=eth_price&order_direction=desc`)
    return response.orders
}

const getFloorAndOffer = async (slug, token, isCollectionOffer) => {
    const offerParams = await getCollectionOffers(slug)
    const collectionName = offerParams.offers[0].criteria.collection.slug
    const collectionAddress = offerParams.offers[0].criteria.contract.address

    let highestOffer
    let highestOfferer
    let floorPrice
    let quantity

    if (isCollectionOffer) {
        quantity = offerParams.offers[0].protocol_data.parameters.consideration[0].startAmount
        highestOffer = offerParams.offers[0].protocol_data.parameters.offer[0].startAmount / (10 ** 18) / quantity
        highestOfferer = offerParams.offers[0].protocol_data.parameters.offerer

        let listing_prices = []

        let listings
        let next = null

        const getListings = async (next) => {
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

        floorPrice = getLowestListing()
    } else {
        const offers = await retrieveOffers(collectionAddress, token)
        quantity = offers[0].protocol_data.parameters.consideration[0].startAmount
        highestOffer = offers[0].protocol_data.parameters.offer[0].startAmount / (10 ** 18) / quantity
        highestOfferer = offers[0].protocol_data.parameters.offerer

        const listings = await retrieveListings(collectionAddress, token)
        let listing_prices = []
        for (let i = 0; i < listings.length; i++) {
            listing_prices.push(listings[i].current_price / (10 ** 18))
        }
        const getLowestListing = () => {
            return Math.min(...listing_prices)
        }

        floorPrice = getLowestListing()
    }

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
    buildTraitCollectionOffer,
    buildItemOffer,
    postItemOffer,
    signOffer,
    postCriteriaOffer,
    getFloorAndOffer,
    getTraits,
    getCollection,
    getNfts
}