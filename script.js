document.addEventListener('DOMContentLoaded', () => {
  // Event listeners for color mode radio buttons
  const solidRadio = document.getElementById('colorModeSolid');
  const gradientRadio = document.getElementById('colorModeGradient');
  const solidOptions = document.getElementById('solidColorOptions');
  const gradientOptions = document.getElementById('gradientOptions');

  solidRadio.addEventListener('change', () => {
    if (solidRadio.checked) {
      solidOptions.style.display = 'block';
      gradientOptions.style.display = 'none';
    }
  });

  gradientRadio.addEventListener('change', () => {
    if (gradientRadio.checked) {
      solidOptions.style.display = 'none';
      gradientOptions.style.display = 'block';
    }
  });
});

async function generateQRCode() {
  const url = document.getElementById('url').value;
  const backColor = document.getElementById('backColor').value;
  const logoFile = document.getElementById('logo').files[0];
  const moduleShape = document.getElementById('moduleShape').value;
  const colorMode = document.querySelector('input[name="colorMode"]:checked').value;

  if (!url) {
    alert('Enter a URL');
    return;
  }

  let payload = {
    url,
    backColor,
    moduleShape,
    colorMode,
    logo: null
  };

  if (colorMode === 'solid') {
    payload.fillColor = document.getElementById('fillColor').value;
  } else {
    payload.gradientType = document.getElementById('gradientType').value;
    payload.gradientColor1 = document.getElementById('gradientColor1').value;
    payload.gradientColor2 = document.getElementById('gradientColor2').value;
  }

  // If there's a logo, read it as DataURL
  if (logoFile) {
    payload.logo = await new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = e => res(e.target.result);
      reader.onerror = rej;
      reader.readAsDataURL(logoFile);
    });
  }

  // Send all params off to Python
  try {
      const resp = await fetch('/api/qrcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({ error: 'Server error generating QR' }));
        alert(`Error: ${errorData.error || 'Unknown server error'}`);
        return;
      }

      const { image } = await resp.json();
      displayQRCode(image);
  } catch (error) {
      console.error('Fetch error:', error);
      alert('Failed to connect to the server.');
  }
}

function displayQRCode(dataUrl) {
  const container = document.getElementById('qrcode');
  container.innerHTML = ''; // Clear previous QR code or placeholder text
  const img = new Image();
  img.src = dataUrl;
  img.alt = 'QR Code';
  img.style.maxWidth = '100%'; // Ensure image fits container
  img.style.height = 'auto';
  img.style.borderRadius = '10px';
  container.appendChild(img);

  // Add download button if not already present
  let dlButton = container.querySelector('.download-button');
  if (!dlButton) {
      dlButton = document.createElement('button');
      dlButton.textContent = 'Download QR Code';
      dlButton.className = 'btn btn-secondary mt-3 download-button';
      dlButton.onclick = () => {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = 'qr_code.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };
      container.appendChild(dlButton);
  } else {
      dlButton.onclick = () => {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = 'qr_code.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };
  }
}
