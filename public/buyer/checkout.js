const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "/auth/login.html";
}

const cart =
  JSON.parse(localStorage.getItem("directBuy")) ||
  JSON.parse(localStorage.getItem("cart")) ||
  [];

/* =========================
   INIT CHECKOUT
========================= */
async function initCheckout() {
  try {
    const payRes = await fetch("/api/settings/payment-methods", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!payRes.ok) throw new Error("Failed to load payment methods");

    const methods = await payRes.json();
    const select = document.getElementById("paymentMethod");

    select.innerHTML = `<option value="">Select Payment Method</option>`;

    let enabledCount = 0;

    Object.entries(methods).forEach(([key, m]) => {
      if (m.enabled) {
        enabledCount++;
        
        // If payment method has account number, show it in the option
        if (m.accountNumber) {
          select.innerHTML += `<option value="${key}">${m.label} - ${m.accountNumber}</option>`;
        } else {
          select.innerHTML += `<option value="${key}">${m.label}</option>`;
        }
      }
    });

    if (enabledCount === 0) {
      alert("No payment methods available. Please contact admin.");
      document.querySelector("button[type='submit']").disabled = true;
    }
  } catch (err) {
    console.error(err);
    alert("Failed to load payment methods");
  }
}

/* =========================
   FORM SUBMIT
========================= */
document.getElementById("checkoutForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const inputs = e.target.querySelectorAll("input");
  const paymentMethod = document.getElementById("paymentMethod").value;

  if (!paymentMethod) {
    alert("Please select a payment method");
    return;
  }

  const address = {
    fullName: inputs[0].value,
    phone: inputs[1].value,
    street: inputs[2].value,
    city: inputs[3].value,
    zip: inputs[4].value,
    country: inputs[5].value
  };

  const res = await fetch("/api/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      items: cart,
      paymentMethod,
      address
    })
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.message || "Checkout failed");
    return;
  }

  localStorage.removeItem("cart");
  localStorage.removeItem("directBuy");

  alert("Order placed successfully! ✅");
  window.location.href = "./orders.html";
});

initCheckout();