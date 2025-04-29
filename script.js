// script.js
import * as THREE           from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { OrbitControls }    from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { EffectComposer }   from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass }       from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass }  from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ObjectLoader }     from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/ObjectLoader.js';
import { CSS3DRenderer,CSS3DObject }
                            from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/renderers/CSS3DRenderer.js';

/* ------------------------------------------------------------------ */
/*  SCENE + RENDERERS                                                 */
/* ------------------------------------------------------------------ */
const webglCanvas=document.getElementById('bg');
const scene     =new THREE.Scene();
scene.fog       =new THREE.Fog(0x06080e,10,50);

const camera=new THREE.PerspectiveCamera(35,innerWidth/innerHeight,.1,100);
camera.position.set(0,1.25,3.5);

const renderer=new THREE.WebGLRenderer({canvas:webglCanvas,antialias:true});
renderer.setSize(innerWidth,innerHeight);
renderer.setPixelRatio(devicePixelRatio);
renderer.shadowMap.enabled=true;

const cssRenderer=new CSS3DRenderer();
cssRenderer.setSize(innerWidth,innerHeight);
cssRenderer.domElement.style.position='absolute';
cssRenderer.domElement.style.top='0';
cssRenderer.domElement.style.pointerEvents='none';
document.body.appendChild(cssRenderer.domElement);

/* ------------------------------------------------------------------ */
/*  LIGHTING                                                          */
/* ------------------------------------------------------------------ */
scene.add(new THREE.AmbientLight(0x0c1640,1.2));
const key=new THREE.PointLight(0x11f4ff,3,10); key.position.set(2,3,2);   scene.add(key);
const rim=new THREE.PointLight(0x0040ff,2,10); rim.position.set(-2,2,-2); scene.add(rim);

/* ------------------------------------------------------------------ */
/*  LOAD JSON SCENE + MAP UI                                          */
/* ------------------------------------------------------------------ */
const cssScene=new THREE.Scene();
const objLoader=new ObjectLoader();

fetch('./project.json')
  .then(r=>r.json())
  .then(json=>{
    const jsonScene=objLoader.parse(json.scene);
    scene.add(jsonScene);

    jsonScene.traverse(o=>{
      if(o.isMesh){
        o.castShadow=o.receiveShadow=true;
        if(o.material&&o.material.isMeshStandardMaterial){
          o.material.emissive=new THREE.Color(0x11f4ff).multiplyScalar(.15);
        }
      }
    });

    let screen=jsonScene.getObjectByName('Box');
    if(!screen)screen=jsonScene;

    const uiDiv=document.getElementById('qr-ui');
    uiDiv.style.pointerEvents='auto';
    const uiObj=new CSS3DObject(uiDiv);
    screen.add(uiObj);
    uiObj.position.set(0,0,0.05);
    uiObj.scale.setScalar(.33); /* tweak for perfect fit */
  })
  .catch(console.error);

/* ------------------------------------------------------------------ */
/*  POSTPROCESSING                                                    */
/* ------------------------------------------------------------------ */
const composer=new EffectComposer(renderer);
composer.addPass(new RenderPass(scene,camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.8,.4,.85));

/* ------------------------------------------------------------------ */
/*  CONTROLS + RESIZE                                                 */
/* ------------------------------------------------------------------ */
const controls=new OrbitControls(camera,webglCanvas);
controls.enablePan=false;controls.minDistance=3;controls.maxDistance=5;
controls.target.set(0,1,0);controls.update();

addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
  composer.setSize(innerWidth,innerHeight);
  cssRenderer.setSize(innerWidth,innerHeight);
});

/* ------------------------------------------------------------------ */
/*  RENDER LOOP                                                       */
/* ------------------------------------------------------------------ */
(function animate(){
  requestAnimationFrame(animate);
  composer.render();
  cssRenderer.render(cssScene,camera);
})();

/* ------------------------------------------------------------------ */
/*  UI BEHAVIOUR                                                      */
/* ------------------------------------------------------------------ */
document.addEventListener('DOMContentLoaded',()=>{
  const solid=document.getElementById('colorModeSolid');
  const grad=document.getElementById('colorModeGradient');
  const solidWrap=document.getElementById('solidColorOptions');
  const gradWrap=document.getElementById('gradientOptions');
  const theme=document.getElementById('theme-toggle');

  const sync=()=>{solidWrap.classList.toggle('d-none',!solid.checked);gradWrap.classList.toggle('d-none',!grad.checked)};
  solid.onchange=grad.onchange=sync; sync();

  theme.onclick=()=>{
    document.body.classList.toggle('light');
    theme.innerHTML=document.body.classList.contains('light')?'<i class="bi bi-brightness-low-fill"></i>':'<i class="bi bi-moon-stars"></i>';
  };
});

/* ------------------------------------------------------------------ */
/*  QR GENERATION                                                     */
/* ------------------------------------------------------------------ */
async function generateQRCode(){
  const url=document.getElementById('url').value.trim();
  if(!url){alert('Please enter a URL');return;}

  const payload={
    url,
    moduleShape:document.getElementById('moduleShape').value,
    colorMode:document.querySelector('input[name=colorMode]:checked').value,
    backColor:document.getElementById('backColor').value
  };

  if(payload.colorMode==='solid'){
    payload.fillColor=document.getElementById('fillColor').value;
  }else{
    payload.gradientType  =document.getElementById('gradientType').value;
    payload.gradientColor1=document.getElementById('gradientColor1').value;
    payload.gradientColor2=document.getElementById('gradientColor2').value;
  }

  const logoFile=document.getElementById('logo').files[0];
  if(logoFile){
    payload.logo=await new Promise((res,rej)=>{
      const r=new FileReader();
      r.onload=e=>res(e.target.result);
      r.onerror=rej;
      r.readAsDataURL(logoFile);
    });
  }

  try{
    const r=await fetch('/api/qrcode',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if(!r.ok){alert((await r.json()).error||'Server error');return;}
    displayQRCode((await r.json()).image);
  }catch(e){console.error(e);alert('Network error');}
}
window.generateQRCode=generateQRCode;

function displayQRCode(dataURL){
  const wrap=document.getElementById('qrcode');
  wrap.innerHTML='';
  const img=new Image();
  img.src=dataURL;img.alt='QR Code';img.style.maxWidth='100%';img.style.borderRadius='var(--radius)';img.style.boxShadow='var(--c-shadow)';
  wrap.appendChild(img);

  const btn=document.createElement('button');
  btn.textContent='Download';btn.className='btn-primary';btn.style.marginTop='12px';
  btn.onclick=()=>{const a=document.createElement('a');a.href=dataURL;a.download='qr_code.png';document.body.appendChild(a);a.click();a.remove();};
  wrap.appendChild(btn);
}
