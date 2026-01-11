const cart = JSON.parse(localStorage.getItem("cart") || "[]");
const container = document.getElementById("cartItems");

let total = 0;

if (cart.length === 0) {
  container.innerHTML = "<p>Cart is empty</p>";
} else {
  cart.forEach(item => {
    total += Number(item.finalPrice) * Number(item.qty);


    container.innerHTML += `
      <div class="cart-item">
        <img src="${item.imageUrl || ''}" width="80" />
        <strong>${item.name}</strong>
        <p>Qty: ${item.qty}</p>
        <p>Price: $${item.finalPrice}</p>
      </div>
    `;
  });

  document.getElementById("cartTotal").textContent =
    `Total: $${total.toFixed(2)}`;
}

function goCheckout() {
  localStorage.removeItem("directBuy");
  window.location.href = "./checkout.html";
}
