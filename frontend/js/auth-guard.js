(async function () {

    const {
        data: { session }
    } = await supabaseClient.auth.getSession();
    
    if (!session) {
        window.location.href = "login.html";
    }

    const userEmailP = document.getElementById("user-email");
    userEmailP.textContent = session.user.email;

    const userIdP = document.getElementById("user-id");
    userIdP.textContent = session.user.id;

    const accessTokenP = document.getElementById("access-token");
    accessTokenP.textContent = session.access_token;

    const displayNameP = document.getElementById("display-name");
    displayNameP.textContent = session.user.user_metadata.display_name || "N/A";

})();