 function changeProductQuantity(cartId, proId, count) {
  console.log("Clicked:", { cartId, proId, count }); // ✅ Check if this runs
  let quantity = parseInt(document.getElementById('qty-' + proId).innerText);

  $.ajax({
    url: '/change-product-quantity',
    method: 'post',
    data: {
      cart: cartId,
      product: proId,
      count: count,
      quantity: quantity
    },
    success: (response) => {
      console.log("Response:", response);
      if (response.removeProduct) {
        location.reload();
      } else {
        document.getElementById('qty-' + proId).innerHTML = response.quantity;
      }
    },
    error: (err) => {
      console.error("AJAX Error:", err);
    }
  });
}
function removeFromCart(cartId, productId, event) {
  if (event) event.preventDefault(); // ✅ prevent form submission or reload

  Swal.fire({
    title: 'Are you sure?',
    text: 'This product will be removed from your cart.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    cancelButtonColor: '#3085d6',
    confirmButtonText: 'Yes, remove it!',
    cancelButtonText: 'Cancel'
  }).then((result) => {
    if (result.isConfirmed) {
      $.ajax({
        url: '/remove-from-cart',
        method: 'post',
        data: {
          cart: cartId,
          product: productId
        },
        success: (response) => {
  if (response.removeProduct) {
    document.getElementById('product-row-' + proId).remove();
  } else {
    document.getElementById('qty-' + proId).innerHTML = response.quantity;
  }

  // Update total if backend sends it
  if (response.total) {
    document.getElementById('cart-total').innerText = "₹" + response.total;
  }
}
,
        error: (err) => {
          Swal.fire('Error', 'Could not remove product. Try again.', 'error');
          console.error("❌ AJAX Error:", err);
        }
      });
    }
  });
}
