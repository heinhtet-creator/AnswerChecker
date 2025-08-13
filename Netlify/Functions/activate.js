// netlify/functions/activate.js

exports.handler = async function(event, context) {
    // 1. Get the PIN from the request sent by the browser
    const { pin } = JSON.parse(event.body);

    // 2. Get the list of valid PINs from secure environment variables
    const validPins = process.env.ACTIVATION_PINS || "";
    const pinList = validPins.split(',').map(p => p.trim());

    // 3. Check if the submitted PIN is in our list
    if (pin && pinList.includes(pin)) {
        // If it is valid, return success
        return {
            statusCode: 200,
            body: JSON.stringify({ success: true })
        };
    } else {
        // If it is invalid, return failure
        return {
            statusCode: 401,
            body: JSON.stringify({ success: false, message: 'Activate PIN မမှန်ပါ။' })
        };
    }
};


