/**
 * CustomSelect - Dark-themed dropdown replacement for native <select>
 * Renders a fully custom dropdown overlay matching the site's dark design.
 */
(function() {
  'use strict';

  var instances = [];

  function CustomSelect(el, opts) {
    this.el = el;
    this.opts = opts || {};
    this.value = el.value;
    this.isOpen = false;
    this.options = [];
    this._build();
    instances.push(this);
  }

  CustomSelect.prototype._build = function() {
    var self = this;
    var opts = this.el.querySelectorAll('option');
    this.options = [];
    opts.forEach(function(o) {
      self.options.push({ value: o.value, text: o.textContent.trim(), selected: o.selected });
    });

    // Create wrapper
    this.wrapper = document.createElement('div');
    this.wrapper.className = 'cs-wrap';
    this.wrapper.style.cssText = 'position:relative;display:inline-block;';

    // Create trigger button
    this.trigger = document.createElement('button');
    this.trigger.type = 'button';
    this.trigger.className = 'cs-trigger';
    this.trigger.style.cssText =
      'display:inline-flex;align-items:center;gap:0.4rem;' +
      'padding:0.45rem 2rem 0.45rem 0.75rem;' +
      'background:rgba(255,255,255,0.04);' +
      'border:1px solid rgba(255,255,255,0.08);' +
      'border-radius:12px;' +
      'color:#d1d5db;' +
      'font-size:0.8rem;font-weight:600;' +
      'cursor:pointer;white-space:nowrap;' +
      'transition:all 0.2s ease;' +
      'font-family:inherit;' +
      'text-align:left;';
    this.trigger.innerHTML = '<span class="cs-label"></span>' +
      '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" style="flex-shrink:0;margin-left:2px;">' +
      '<path d="M2 4L5 7L8 4" stroke="#6b7280" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';

    this.trigger.addEventListener('mouseenter', function() {
      self.trigger.style.borderColor = 'rgba(255,255,255,0.2)';
      self.trigger.style.background = 'rgba(255,255,255,0.07)';
    });
    this.trigger.addEventListener('mouseleave', function() {
      if (!self.isOpen) {
        self.trigger.style.borderColor = 'rgba(255,255,255,0.08)';
        self.trigger.style.background = 'rgba(255,255,255,0.04)';
      }
    });
    this.trigger.addEventListener('click', function(e) {
      e.stopPropagation();
      self.toggle();
    });

    // Create dropdown panel
    this.panel = document.createElement('div');
    this.panel.className = 'cs-panel';
    this.panel.style.cssText =
      'position:absolute;top:calc(100% + 6px);left:0;min-width:100%;' +
      'background:#12151b;border:1px solid rgba(255,255,255,0.1);' +
      'border-radius:12px;padding:6px;' +
      'box-shadow:0 16px 48px rgba(0,0,0,0.5);' +
      'z-index:1000;display:none;' +
      'max-height:280px;overflow-y:auto;';

    // Scrollbar
    this.panel.style.scrollbarWidth = 'thin';
    this.panel.style.scrollbarColor = 'rgba(255,255,255,0.1) transparent';

    this._renderOptions();

    this.wrapper.appendChild(this.trigger);
    this.wrapper.appendChild(this.panel);

    // Replace original select
    this.el.style.display = 'none';
    this.el.parentNode.insertBefore(this.wrapper, this.el);

    this._updateLabel();
  };

  CustomSelect.prototype._renderOptions = function() {
    var self = this;
    this.panel.innerHTML = '';
    this.options.forEach(function(opt) {
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'cs-item';
      item.style.cssText =
        'display:flex;align-items:center;gap:0.5rem;width:100%;' +
        'padding:0.55rem 0.75rem;border:none;border-radius:8px;' +
        'background:transparent;color:#9ca3af;' +
        'font-size:0.8rem;font-weight:500;text-align:left;' +
        'cursor:pointer;transition:all 0.12s ease;font-family:inherit;';
      item.textContent = opt.text;
      item.dataset.value = opt.value;

      if (opt.value === self.value) {
        item.style.background = 'rgba(255,255,255,0.08)';
        item.style.color = '#fff';
        item.style.fontWeight = '700';
      }

      item.addEventListener('mouseenter', function() {
        if (opt.value !== self.value) {
          item.style.background = 'rgba(255,255,255,0.05)';
          item.style.color = '#d1d5db';
        }
      });
      item.addEventListener('mouseleave', function() {
        if (opt.value !== self.value) {
          item.style.background = 'transparent';
          item.style.color = '#9ca3af';
        }
      });
      item.addEventListener('click', function(e) {
        e.stopPropagation();
        self.select(opt.value);
      });

      self.panel.appendChild(item);
    });
  };

  CustomSelect.prototype._updateLabel = function() {
    var self = this;
    var selected = this.options.find(function(o) { return o.value === self.value; });
    var label = this.trigger.querySelector('.cs-label');
    if (selected && label) {
      label.textContent = selected.text;
    }
  };

  CustomSelect.prototype.select = function(value) {
    this.value = value;
    this.el.value = value;
    this._updateLabel();
    this._renderOptions();
    this.close();

    // Update option selected state
    this.options.forEach(function(o) { o.selected = (o.value === value); });

    // Trigger change event
    var evt = new Event('change', { bubbles: true });
    this.el.dispatchEvent(evt);
  };

  CustomSelect.prototype.toggle = function() {
    if (this.isOpen) this.close();
    else this.open();
  };

  CustomSelect.prototype.open = function() {
    // Close all other instances
    instances.forEach(function(inst) {
      if (inst !== this) inst.close();
    }.bind(this));

    this.isOpen = true;
    this.panel.style.display = 'block';
    this.trigger.style.borderColor = 'rgba(255,255,255,0.25)';
    this.trigger.style.background = 'rgba(255,255,255,0.08)';

    // Animate in
    this.panel.style.opacity = '0';
    this.panel.style.transform = 'translateY(-4px)';
    this.panel.style.transition = 'opacity 0.15s ease, transform 0.15s ease';
    requestAnimationFrame(function() {
      this.panel.style.opacity = '1';
      this.panel.style.transform = 'translateY(0)';
    }.bind(this));
  };

  CustomSelect.prototype.close = function() {
    this.isOpen = false;
    this.panel.style.display = 'none';
    this.trigger.style.borderColor = 'rgba(255,255,255,0.08)';
    this.trigger.style.background = 'rgba(255,255,255,0.04)';
  };

  // Close on outside click
  document.addEventListener('click', function() {
    instances.forEach(function(inst) { inst.close(); });
  });

  // Prevent panel clicks from closing
  document.addEventListener('click', function(e) {
    if (e.target.closest('.cs-panel')) e.stopPropagation();
  });

  // Public API
  window.CustomSelect = {
    create: function(el, opts) {
      if (el._csInstance) return el._csInstance;
      var inst = new CustomSelect(el, opts);
      el._csInstance = inst;
      return inst;
    },
    initAll: function() {
      document.querySelectorAll('select[data-custom]').forEach(function(el) {
        CustomSelect.create(el);
      });
    }
  };
})();
