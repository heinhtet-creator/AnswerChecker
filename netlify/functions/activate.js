// netlify/functions/activate.js (NEW SIMPLIFIED VERSION)
const { createClient } = require('@supabase/supabase-js');

exports.handler = async function(event, context) {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { pin } = JSON.parse(event.body);

    if (!pin) {
        return { statusCode: 400, body: JSON.stringify({ success: false, message: 'PIN is required.' }) };
    }

    try {
        // Just check if the pin exists in the table.
        const { data, error } = await supabase
            .from('pins')
            .select('pin_code')
            .eq('pin_code', pin)
            .single();

        if (error || !data) {
            // If no row is found, the PIN is invalid.
            return { statusCode: 404, body: JSON.stringify({ success: false, message: 'Activate PIN မမှန်ပါ။' }) };
        }

        // If a row is found, the PIN is valid. No need to check or update 'is_used'.
        return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Activate လုပ်ခြင်း အောင်မြင်ပါသည်။' }) };

    } catch (err) {
        console.error('Activation error:', err);
        return { statusCode: 500, body: JSON.stringify({ success: false, message: 'Server တွင် Error ဖြစ်နေပါသည်။' }) };
    }
};
