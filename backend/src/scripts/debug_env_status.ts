import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

console.log('--- 🛡️ ENVIRONMENT DIAGNOSTIC ---');

const checkEnv = (name: string) => {
    const val = process.env[name];
    if (!val) {
        console.log(`❌ ${name}: MISSING`);
    } else {
        const masked = val.length > 10 ? val.substring(0, 5) + '...' + val.substring(val.length - 3) : '***';
        console.log(`✅ ${name}: FOUND (${masked})`);
    }
};

checkEnv('SUPABASE_URL');
checkEnv('SUPABASE_KEY');
checkEnv('BIFROST_URL'); // For proxy checks

console.log('Current CWD:', process.cwd());
console.log('__dirname:', __dirname);
console.log('Resolved .env path:', path.join(__dirname, '../../.env'));
