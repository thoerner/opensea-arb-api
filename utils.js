import axios from 'axios'
import config from './config.js'

const { apiKey } = config

export const getRequest = async (url, retryCount = 0) => {
    const options = {
        method: 'GET',
        url,
        headers: {
            accept: 'application/json',
            'X-API-KEY': apiKey,
            'Content-Type': 'application/json'
        }
    }
    try {
        const { data } = await axios.request(options)
        return data
    } catch (error) {
        if (retryCount > 3) {
            throw new Error(error)
        } else {
            await new Promise(r => setTimeout(r, 2000))
            return getRequest(url, retryCount + 1)
        }
    }
}

export const postRequest = async (url, payload, retryCount = 0) => {
    const options = {
        method: 'POST',
        url,
        headers: {
            accept: 'application/json',
            'X-API-KEY': apiKey,
            'Content-Type': 'application/json'
        },
        data: payload
    }
    try {
        const { data } = await axios.request(options)
        return data
    } catch (error) {
        if (retryCount > 3) {
            return {
                error: error.response.data
            }
        } else {
            await new Promise(r => setTimeout(r, 2000))
            return postRequest(url, payload, retryCount + 1)
        }
    }
}

export function genSalt(digits) {
    let randomNumber = '';

    for (let i = 0; i < digits; i++) {
        randomNumber += Math.floor(Math.random() * 10);
    }

    return randomNumber.toString();
}

export function getTrimmedPriceInWei(price) {
    let priceWei = BigInt(Math.floor(price * (10 ** 18)));
    let priceWeiTrimmed = BigInt(Math.floor(Number(priceWei) / (10**14)) * (10**14));
    const increment = BigInt(Math.round(0.0001 * (10 ** 18)));
    priceWeiTrimmed += increment;
    return priceWeiTrimmed;
}