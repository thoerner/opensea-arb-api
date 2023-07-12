import { ethers } from 'ethers'
import { OpenSeaSDK, Chain } from 'opensea-js'
import dotenv from 'dotenv'
dotenv.config()

const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL)
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider)

export const openseaSDK = new OpenSeaSDK(wallet, {
    networkName: Chain.Mainnet,
    apiKey: process.env.API_KEY,
})

export const getOrders = async (assetContractAddress, tokenId) => {
    const { orders } = await openseaSDK.api.getOrders({
        assetContractAddress,
        tokenId,
        side: "bid",
    });
    return orders
}

const findOurOrders = async (assetContractAddress, tokenId) => {
    const orders = await getOrders(assetContractAddress, tokenId)
    const ourOrders = orders.filter(order => order.maker.address.toLowerCase() === wallet.address.toLowerCase())
    return ourOrders
}

console.log(await findOurOrders('0x65f9f7f4a4ddd517b35c9357f575f0f1df431cbc', '0'))