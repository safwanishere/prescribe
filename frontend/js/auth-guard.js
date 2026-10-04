(async function () {

    const {
        data: { session }
    } = await supabaseClient.auth.getSession();
    
    if (!session) {
        window.location.href = "login.html";
    }

    const userEmailP = document.getElementById("user-email");
    userEmailP.textContent = session.user.email;

    const displayNameP = document.getElementById("display-name");
    displayNameP.textContent = session.user.user_metadata.display_name || "N/A";

})();