// Presentation-only overlays shared by both Explore viewers. This module never
// changes model state: it projects the selected object into the viewport and
// keeps the small orientation indicator aligned with the active camera.
export function createViewerHud({THREE, camera, container}) {
  const callout = document.getElementById('selection-callout');
  const anchor = document.getElementById('selection-anchor');
  const name = document.getElementById('callout-name');
  const description = document.getElementById('callout-function');
  const axisElements = {
    x: [document.getElementById('axis-x-line'), document.getElementById('axis-x-label')],
    y: [document.getElementById('axis-y-line'), document.getElementById('axis-y-label')],
    z: [document.getElementById('axis-z-line'), document.getElementById('axis-z-label')],
  };
  const axisVectors = {
    x: new THREE.Vector3(1, 0, 0),
    y: new THREE.Vector3(0, 1, 0),
    z: new THREE.Vector3(0, 0, 1),
  };
  const projected = new THREE.Vector3();
  const box = new THREE.Box3();
  const inverseCamera = new THREE.Quaternion();
  let selectedObject = null;

  function updateOrientation() {
    inverseCamera.copy(camera.quaternion).invert();
    for (const [key, source] of Object.entries(axisVectors)) {
      const [line, label] = axisElements[key];
      if (!line || !label) continue;
      const vector = source.clone().applyQuaternion(inverseCamera);
      const x = 32 + vector.x * 18;
      const y = 32 - vector.y * 18;
      line.setAttribute('x2', x.toFixed(1));
      line.setAttribute('y2', y.toFixed(1));
      line.style.opacity = String(.45 + Math.max(0, vector.z) * .55);
      label.setAttribute('x', (32 + vector.x * 24).toFixed(1));
      label.setAttribute('y', (35 - vector.y * 24).toFixed(1));
      label.style.opacity = String(.6 + Math.max(0, vector.z) * .4);
    }
  }

  function updateSelection() {
    if (!selectedObject || !callout || !anchor || !selectedObject.visible) {
      if (callout) callout.hidden = true;
      if (anchor) anchor.hidden = true;
      return;
    }
    selectedObject.updateWorldMatrix(true, false);
    box.setFromObject(selectedObject).getCenter(projected).project(camera);
    if (projected.z < -1 || projected.z > 1 || Math.abs(projected.x) > 1.12 || Math.abs(projected.y) > 1.12) {
      callout.hidden = true;
      anchor.hidden = true;
      return;
    }
    const rect = container.getBoundingClientRect();
    const x = (projected.x + 1) * rect.width / 2;
    const y = (1 - projected.y) * rect.height / 2;
    const cardWidth = Math.min(246, Math.max(184, rect.width * .48));
    const placeLeft = x > rect.width * .56;
    const left = Math.max(12, Math.min(rect.width - cardWidth - 12, placeLeft ? x - cardWidth - 24 : x + 24));
    const top = Math.max(76, Math.min(rect.height - 112, y - 26));
    anchor.style.left = `${x}px`;
    anchor.style.top = `${y}px`;
    callout.style.left = `${left}px`;
    callout.style.top = `${top}px`;
    callout.style.width = `${cardWidth}px`;
    callout.dataset.side = placeLeft ? 'left' : 'right';
    anchor.hidden = false;
    callout.hidden = false;
  }

  function update() {
    updateOrientation();
    updateSelection();
  }

  return {
    setSelection(object, title, body) {
      selectedObject = object || null;
      if (name) name.textContent = title || 'Selected component';
      if (description) description.textContent = body || '';
      updateSelection();
    },
    clearSelection() {
      selectedObject = null;
      updateSelection();
    },
    update,
  };
}
