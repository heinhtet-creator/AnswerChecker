const { createClient } = require('@supabase/supabase-js');
exports.handler = async function(event, context) {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const { pin } = JSON.parse(event.body);
    if (!pin) {
        return { statusCode: 400, body: JSON.stringify({ success: false, message: 'PIN is required.' }) };
    }
    try {
        const { data, error } = await supabase.from('pins').select('is_used').eq('pin_code', pin).single();
        if (error || !data) {
            return { statusCode: 404, body: JSON.stringify({ success: false, message: 'Activate PIN မမှန်ပါ။' }) };
        }
        if (data.is_used) {
            return { statusCode: 403, body: JSON.stringify({ success: false, message: 'ဤ PIN ကို အသုံးပြုပြီးဖြစ်ပါသည်။' }) };
        } else {
            const { error: updateError } = await supabase.from('pins').update({ is_used: true }).eq('pin_code', pin);
            if (updateError) throw updateError;
            return { statusCode: 200, body: JSON.stringify({ success: true, message: 'Activate လုပ်ခြင်း အောင်မြင်ပါသည်။' }) };
        }
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ success: false, message: 'Server တွင် Error ဖြစ်နေပါသည်။' }) };
    }
};
