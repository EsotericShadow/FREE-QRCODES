async function generateQRCode() {
  const url = document.getElementById('url').value;
  const fillColor = document.getElementById('fillColor').value;
  const backColor = document.getElementById('backColor').value;
  const logoFile = document.getElementById('logo').files[0];

  if (!url) {
    alert('Enter a URL');
    return;
  }

  // If there's a logo, read it as DataURL
  let logoData = null;
  if (logoFile) {
    logoData = await new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = e => res(e.target.result);
      reader.onerror = rej;
      reader.readAsDataURL(logoFile);
    });
  }

  // Send all params off to Python
  const resp = await fetch('/api/qrcode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, fillColor, backColor, logo: logoData })
  });

  if (!resp.ok) {
    alert('Server error generating QR');
    return;
  }

  const { image } = await resp.json();
  displayQRCode(image);
}

function displayQRCode(dataUrl) {
  const container = document.getElementById('qrcode');
  container.innerHTML = '';
  const img = new Image();
  img.src = dataUrl;
  img.alt = 'QR Code';
  img.style.borderRadius = '10px';
  img.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
  container.appendChild(img);

  const dl = document.createElement('button');
  dl.textContent = 'Download QR Code';
  dl.className = 'btn btn-secondary mt-3';
  dl.onclick = () => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'qr_code.png';
    a.click();
  };
  container.appendChild(dl);
}

// Theme toggle for dark mode
document.getElementById('theme-toggle').addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
  const toggleButton = document.getElementById('theme-toggle');
  toggleButton.textContent = document.body.classList.contains('dark-mode')
    ? 'Toggle Light Mode'
    : 'Toggle Dark Mode';
});
