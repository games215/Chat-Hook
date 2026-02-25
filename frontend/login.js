import { supabase } from './supabase.js';

// Google Sign-In - Ye function frontend JS me add karna hai
document.addEventListener('DOMContentLoaded', () => {
  const googleLoginBtn = document.getElementById('googleLogin');
  
  if (googleLoginBtn) {
    googleLoginBtn.addEventListener('click', async () => {
      await supabase.auth.signInWithOAuth({
        provider: 'google'
      });
    });
  }
});

// Google Login function for onclick attribute
async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
  });

  if (error) console.error(error);
}

// Make function available globally for HTML onclick
window.signInWithGoogle = signInWithGoogle;

// Auto redirect if already logged in
async function checkUserSession() {
  const { data } = await supabase.auth.getSession();

  if (data.session) {
    window.location.href = "/chat.html";
  }
}

checkUserSession();

// Create user in custom users table
async function ensureUserInDatabase(authUser) {
  const { data: existingUser } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .single();

  if (!existingUser) {
    const baseUsername = authUser.email.split("@")[0];
    const uniqueUsername = baseUsername + Math.floor(Math.random() * 1000);

    await supabase.from("users").insert([
      {
        id: authUser.id,
        username: uniqueUsername,
        name: authUser.user_metadata.full_name || "",
        avatar_url: authUser.user_metadata.avatar_url || "",
        country: "",
        gender: ""
      }
    ]);
  }
}

// After login success
supabase.auth.onAuthStateChange(async (event, session) => {
  if (session?.user) {
    localStorage.setItem(
      "chatHookUser",
      JSON.stringify(session.user)
    );

    await ensureUserInDatabase(session.user);

    window.location.href = "/chat.html";
  }
});