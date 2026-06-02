/* eslint-disable @typescript-eslint/no-require-imports */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = 'd:/M3NH3R/.env.local';
let env = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.substring(0, idx).trim();
        const val = trimmed.substring(idx + 1).trim();
        env[key] = val;
      }
    }
  });
}

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['SUPABASE_SERVICE_ROLE_KEY'];
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Testing the mutual connection scenario exactly...');

  const userAId = 'd6a51cab-2085-4563-9dcd-9d372ef2adf8'; // mhakmala
  const userBId = '1742581b-7d4e-46c6-b141-ba3ab9863534'; // ishinij
  
  // We will call the RPC function as if we are User A.
  // To do this via Service Role, we'd normally bypass RLS, but the RPC uses auth.uid().
  // Since we can't easily set auth.uid() using service_role, let's just write a test SQL script
  // or use the anon key if we can authenticate.
  // Wait, I can just create a temporary stored procedure to run the test, or just look at the code.
  
  console.log('Fetching invite codes to find User B code...');
  const { data: inviteCodes } = await supabase.from('invite_codes').select('*').eq('issuer_id', userBId).eq('is_used', false);
  
  if (inviteCodes && inviteCodes.length > 0) {
     const codeB = inviteCodes[0].code;
     console.log('User B code is:', codeB);
     
     // Instead of calling RPC (which requires auth.uid), let's simulate the SQL logic:
     // Does User B have pending_partner_id = User A?
     const { data: userB } = await supabase.from('profiles').select('*').eq('id', userBId).single();
     console.log('User B pending_partner_id:', userB.pending_partner_id, 'Expected:', userAId);
     
     // The SQL tries to insert into notifications. Let's check if there's any RLS on notifications that might fail?
     // The RPC is security definer, so RLS doesn't block it.
  }
}

run();
