const { createClient } = require('@supabase/supabase-js');
exports.handler = async function(event, context) {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    try {
        const { data, error } = await supabase.rpc('get_random_unused_hint');
        if (error) throw error;
        if (!data || data.length === 0) {
            return { statusCode: 404, body: JSON.stringify({ message: 'လက်ကျန် PIN မရှိတော့ပါ။' }) };
        }
        return { statusCode: 200, body: JSON.stringify(data[0]) };
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ message: 'Hint ရယူရာတွင် Error ဖြစ်နေပါသည်။' }) };
    }
};
