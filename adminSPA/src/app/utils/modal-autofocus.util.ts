const SELECTOR_EXPLICITO = '[data-autofocus], [ngbAutofocus], [autofocus]';
const SELECTOR_NOMBRE =
  'input[name="nombre"]:not([disabled]), textarea[name="nombre"]:not([disabled]), input#nombre:not([disabled]), textarea#nombre:not([disabled])';
const SELECTOR_EDITABLE =
  'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="image"]):not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly]), select:not([disabled])';

function esVisible(el: HTMLElement): boolean {
  if (el.hasAttribute('hidden') || (el as HTMLInputElement).disabled) {
    return false;
  }
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') {
    return false;
  }
  return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

function esCampoParaEscribir(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) {
    return false;
  }
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
    return !el.disabled && esVisible(el);
  }
  if (!(el instanceof HTMLInputElement) || el.disabled) {
    return false;
  }
  const tipo = (el.type || 'text').toLowerCase();
  if (['hidden', 'checkbox', 'radio', 'file', 'button', 'submit', 'reset', 'image'].includes(tipo)) {
    return false;
  }
  return esVisible(el);
}

function primerCampoEditable(root: ParentNode): HTMLElement | null {
  const explicito = root.querySelector<HTMLElement>(SELECTOR_EXPLICITO);
  if (explicito && esVisible(explicito) && esCampoParaEscribir(explicito)) {
    return explicito;
  }

  const porNombre = root.querySelector<HTMLElement>(SELECTOR_NOMBRE);
  if (porNombre && esVisible(porNombre)) {
    return porNombre;
  }

  const candidatos = root.querySelectorAll<HTMLElement>(SELECTOR_EDITABLE);
  for (const el of candidatos) {
    if (esVisible(el)) {
      return el;
    }
  }
  return null;
}

function enfocarCampo(el: HTMLElement): void {
  el.focus({ preventScroll: true });
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    try {
      const len = el.value?.length ?? 0;
      el.setSelectionRange(len, len);
    } catch {
      /* number, date, etc. no soportan setSelectionRange */
    }
  }
}

function programarFoco(root: ParentNode): void {
  window.setTimeout(() => {
    const activo = document.activeElement;
    if (activo && root.contains(activo) && esCampoParaEscribir(activo)) {
      return;
    }
    const campo = primerCampoEditable(root);
    if (campo && document.contains(campo)) {
      enfocarCampo(campo);
    }
  }, 40);
}

function esContenedorModal(el: HTMLElement): boolean {
  const tag = el.tagName;
  if (tag === 'NGB-MODAL-WINDOW' || tag === 'NGB-MODAL-BACKDROP') {
    return tag === 'NGB-MODAL-WINDOW';
  }
  return el.classList.contains('modal');
}

function modalEstaVisible(el: HTMLElement): boolean {
  if (!esContenedorModal(el)) {
    return false;
  }
  if (el.classList.contains('show') || el.classList.contains('d-block')) {
    return true;
  }
  const display = window.getComputedStyle(el).display;
  return display === 'block';
}

function recogerModales(node: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  if (esContenedorModal(node)) {
    out.push(node);
  }
  node.querySelectorAll?.('.modal, ngb-modal-window').forEach((el) => {
    out.push(el as HTMLElement);
  });
  return out;
}

/**
 * Al abrir un modal (Bootstrap, ng-bootstrap o overlay .modal),
 * sitúa el cursor en nombre / primer campo de texto.
 */
export function iniciarAutofocusModales(): () => void {
  if (typeof document === 'undefined' || !document.body) {
    return () => undefined;
  }

  const onShownBs = (ev: Event): void => {
    const t = ev.target;
    if (t instanceof HTMLElement) {
      programarFoco(t);
    }
  };
  document.addEventListener('shown.bs.modal', onShownBs, true);

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'childList') {
        m.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) {
            return;
          }
          for (const modal of recogerModales(node)) {
            programarFoco(modal);
          }
        });
      }
      if (m.type === 'attributes' && m.target instanceof HTMLElement && esContenedorModal(m.target)) {
        if (modalEstaVisible(m.target)) {
          programarFoco(m.target);
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style']
  });

  return () => {
    document.removeEventListener('shown.bs.modal', onShownBs, true);
    observer.disconnect();
  };
}
