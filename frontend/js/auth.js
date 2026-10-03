
// SIGN UP FORM SUBMISSION
const signupForm = document.getElementById("signup-form");
if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const email = document.getElementById("email").value;
            const password = document.getElementById("password").value;
            const name = document.getElementById("name").value;

            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    data: {
                    display_name: name,
                    },
                },
            });

            if (error) {
                console.error(error);
                alert(error.message);
                return;
            }

            console.log("User:", data.user);
            console.log("Session:", data.session);

            window.location.href = "dashboard.html";

            alert("Account created!");

    });
}



// LOGIN FORM SUBMISSION
const loginForm = document.getElementById("login-form");
if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {

            e.preventDefault();

            const email = document.getElementById("email").value;
            const password = document.getElementById("password").value;

            const { data, error } =
                await supabaseClient.auth.signInWithPassword({
                    email,
                    password
                });

            if (error) {
                console.error(error);
                alert(error.message);
                return;
            }

            console.log("User:", data.user);
            console.log("Session:", data.session);

            // Login successful
            window.location.href = "dashboard.html";
    });
}



// LOGOUT BUTTON
const logoutBtn = document.getElementById("logout-btn");
if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
    
            const { error } = await supabaseClient.auth.signOut();
    
            if (error) {
                console.error(error);
                return;
            }
    
            window.location.href = "login.html";
        });
}