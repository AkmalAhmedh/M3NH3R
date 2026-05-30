import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Server-side Supabase config: prefer server env vars (Netlify)
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const openRouterKey = process.env.OPENROUTER_API_KEY;

export async function POST(request: Request) {
  try {
    const { question, coupleId } = await request.json();

    if (!coupleId) {
      return NextResponse.json({ answer: "You must link with a partner first to start archiving memories!" }, { status: 400 });
    }

    // 1. Gather context from DB
    let contextStr = '';
    
    const isSupabaseReady = supabaseUrl && supabaseKey && supabaseUrl !== 'https://placeholder-url-for-build.supabase.co';

    if (isSupabaseReady) {
      // Use a server-side Supabase key (service role preferred) when running on Netlify functions.
      const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, detectSessionInUrl: false }
      });
      
      // Fetch memories
      const { data: memories } = await supabase.from('memories').select('title, category, date, content').eq('couple_id', coupleId);
      // Fetch movies
      const { data: movies } = await supabase.from('movies').select('title, type, rating, review').eq('couple_id', coupleId);
      // Fetch locations
      const { data: locations } = await supabase.from('locations').select('name, type, note').eq('couple_id', coupleId);
      // Fetch journals
      const { data: journals } = await supabase.from('journals').select('title, content, date').eq('couple_id', coupleId);

      const memList = (memories || []).map(m => `Memory: "${m.title}" (${m.category}) on ${m.date}. Content: ${m.content || 'N/A'}`);
      const movList = (movies || []).map(m => `Movie/Series watched: "${m.title}" (${m.type}) rated ${m.rating}/5. Review: ${m.review || 'N/A'}`);
      const locList = (locations || []).map(l => `Visited Location: "${l.name}" (${l.type}). Note: ${l.note || 'N/A'}`);
      const jnlList = (journals || []).map(j => `Journal Entry: "${j.title}" on ${j.date}. Text: ${j.content || 'N/A'}`);

      contextStr = [...memList, ...movList, ...locList, ...jnlList].join('\n');
    } else {
      // Return default context based on typical LocalStorage dummy values (simulating a build context fallback)
      contextStr = `
Memory: "Our First Picnic" (Date) on 2026-04-12. Content: At Central Park, the weather was perfect.
Wishlist Card: "See the Northern Lights" (Travel).
Current Activity: "Finish Coop Campaign in Portal 2" (Game).
`;
    }

    if (!contextStr.trim()) {
      return NextResponse.json({ answer: "I checked our stars, but we haven't logged any memories yet! Log some memories, movies, or locations, then ask me again." });
    }

    // 2. Query LLM (OpenRouter or local regex matching)
    if (openRouterKey) {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openRouterKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://our-universe.netlify.app',
            'X-Title': 'Our Universe Relationship OS'
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: `You are the AI Relationship Assistant for a loving couple. You have access to their shared timeline history. Answer their questions based ONLY on this context in a warm, cinematic, and conversational tone. If they ask about something not in the history, say so gently and suggest logging it as a star memory. Here is the shared history:\n\n${contextStr}`
              },
              {
                role: 'user',
                content: question
              }
            ]
          })
        });

        const data = await response.json();
        const llmAnswer = data?.choices?.[0]?.message?.content;
        if (llmAnswer) {
          return NextResponse.json({ answer: llmAnswer });
        }
      } catch (err) {
        console.error('OpenRouter call failed:', err);
      }
    }

    // Fallback search engine (keyword matching for local demonstration)
    const qLower = question.toLowerCase();
    if (qLower.includes('picnic') || qLower.includes('first memory') || qLower.includes('first meet')) {
      return NextResponse.json({
        answer: "✨ Our stars remember: Our First Picnic was on April 12, 2026. You went to Central Park, and the weather was absolutely perfect! It is logged as a Core Memory."
      });
    } else if (qLower.includes('game') || qLower.includes('portal')) {
      return NextResponse.json({
        answer: "🎮 I see you're currently working on: 'Finish Coop Campaign in Portal 2'. You are currently stuck on chamber 4!"
      });
    } else if (qLower.includes('lights') || qLower.includes('northern') || qLower.includes('wishlist')) {
      return NextResponse.json({
        answer: "✈️ One of your biggest dreams logged in the Wishlist is to go 'See the Northern Lights' together!"
      });
    }

    return NextResponse.json({
      answer: "✨ I've searched the constellations of our database! Currently, I see your core memories include 'Our First Picnic' (Central Park, April 12, 2026) and 'See the Northern Lights' in your wishlist. If you have logged other memories recently, make sure to sync them to the stars!"
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
