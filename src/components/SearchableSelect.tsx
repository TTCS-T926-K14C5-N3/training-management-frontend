import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, SelectHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import "./SearchableSelect.css";

const PAGE_SIZE = 10;

type SelectOption = {
  value: string;
  label: string;
  disabled: boolean;
};

type SearchableSelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "placeholder"> & {
  children: ReactNode;
  placeholder?: string;
};

const normalizeSearchText = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi");

const optionText = (children: ReactNode): string => {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(optionText).join("");
  }
  if (React.isValidElement<{ children?: ReactNode }>(children)) {
    return optionText(children.props.children);
  }
  return "";
};

const collectOptions = (children: ReactNode): SelectOption[] => {
  const options: SelectOption[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement<{ value?: string | number; disabled?: boolean; label?: string; children?: ReactNode }>(child)) {
      return;
    }
    if (child.type === "optgroup") {
      options.push(...collectOptions(child.props.children));
      return;
    }
    if (child.type !== "option") return;
    const value = String(child.props.value ?? optionText(child.props.children));
    options.push({
      value,
      label: child.props.label ?? optionText(child.props.children) ?? value,
      disabled: Boolean(child.props.disabled),
    });
  });
  return options;
};

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  children,
  className,
  value,
  defaultValue,
  onChange,
  onFocus,
  onBlur,
  disabled = false,
  required = false,
  placeholder,
  id,
  ...nativeProps
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [uncontrolledValue, setUncontrolledValue] = useState(String(defaultValue ?? ""));
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const options = useMemo(() => collectOptions(children), [children]);
  const selectedValue = String(value ?? uncontrolledValue);
  const selectedOption = options.find((option) => option.value === selectedValue);
  const emptyOption = options.find((option) => option.value === "");
  const triggerLabel = selectedOption?.label ?? placeholder ?? emptyOption?.label ?? "Chọn";
  const filteredOptions = options.filter((option) =>
    normalizeSearchText(option.label).includes(normalizeSearchText(query.trim())),
  );
  const pageCount = Math.max(1, Math.ceil(filteredOptions.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleOptions = filteredOptions.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  useEffect(() => {
    if (isOpen) searchRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (
        event.target instanceof Node
        && !rootRef.current?.contains(event.target)
        && !menuRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
        setQuery("");
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current || !menuRef.current) return;

    const positionMenu = () => {
      if (!triggerRef.current || !menuRef.current) return;
      const triggerBounds = triggerRef.current.getBoundingClientRect();
      const menu = menuRef.current;
      const viewportPadding = 8;
      const gap = 5;
      const preferredHeight = Math.min(360, window.innerHeight - viewportPadding * 2);
      const spaceBelow = window.innerHeight - triggerBounds.bottom - gap - viewportPadding;
      const spaceAbove = triggerBounds.top - gap - viewportPadding;
      const openAbove = spaceBelow < Math.min(preferredHeight, 240) && spaceAbove > spaceBelow;
      const availableHeight = Math.max(120, openAbove ? spaceAbove : spaceBelow);
      const width = Math.min(
        Math.max(triggerBounds.width, 260),
        window.innerWidth - viewportPadding * 2,
      );
      const left = Math.max(
        viewportPadding,
        Math.min(triggerBounds.left, window.innerWidth - width - viewportPadding),
      );

      menu.style.width = `${width}px`;
      menu.style.maxHeight = `${availableHeight}px`;
      menu.style.left = `${left}px`;
      menu.style.top = openAbove
        ? `${Math.max(viewportPadding, triggerBounds.top - Math.min(preferredHeight, availableHeight) - gap)}px`
        : `${triggerBounds.bottom + gap}px`;
    };

    positionMenu();
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    return () => {
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
    };
  }, [isOpen]);

  const selectOption = (option: SelectOption) => {
    if (option.disabled || disabled) return;
    if (value === undefined) setUncontrolledValue(option.value);
    const select = selectRef.current;
    if (select) {
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        "value",
      )?.set;
      valueSetter?.call(select, option.value);
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
    setIsOpen(false);
    setQuery("");
  };

  return (
    <div className="searchable-select" ref={rootRef}>
      <select
        {...nativeProps}
        id={id ? `${id}-native` : undefined}
        ref={selectRef}
        className="searchable-select-native"
        value={selectedValue}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        onInvalid={(event) => {
          nativeProps.onInvalid?.(event);
          event.preventDefault();
          setIsOpen(true);
          triggerRef.current?.focus();
        }}
        disabled={disabled}
        required={required}
        aria-hidden="true"
        tabIndex={-1}
      >
        {children}
      </select>
      <button
        type="button"
        ref={triggerRef}
        id={id}
        className={`${className ?? ""} searchable-select-trigger${isOpen ? " is-open" : ""}`.trim()}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-required={required}
        aria-invalid={nativeProps["aria-invalid"]}
        aria-label={nativeProps["aria-label"] ?? triggerLabel}
        aria-describedby={nativeProps["aria-describedby"]}
        onClick={() => {
          setIsOpen((open) => !open);
          setQuery("");
        }}
      >
        <span className={selectedOption ? "" : "searchable-select-placeholder"}>
          {triggerLabel}
        </span>
        <span className="searchable-select-chevron" aria-hidden="true">▾</span>
      </button>
      {isOpen && (
        createPortal(<div ref={menuRef} className="searchable-select-menu">
          <input
            ref={searchRef}
            className="searchable-select-search"
            type="search"
            value={query}
            placeholder="Tìm kiếm..."
            aria-label="Tìm kiếm lựa chọn"
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
          <div className="searchable-select-options" role="listbox">
            {visibleOptions.length ? visibleOptions.map((option) => (
              <button
                type="button"
                role="option"
                aria-selected={option.value === selectedValue}
                key={option.value}
                disabled={option.disabled}
                className={`searchable-select-option${option.value === selectedValue ? " selected" : ""}`}
                onClick={() => selectOption(option)}
              >
                {option.label || "\u00a0"}
              </button>
            )) : <p className="searchable-select-empty">Không tìm thấy lựa chọn phù hợp.</p>}
          </div>
          {pageCount > 1 && (
            <div className="searchable-select-pagination">
              <button type="button" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
                Trước
              </button>
              <span>Trang {currentPage} / {pageCount}</span>
              <button type="button" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>
                Sau
              </button>
            </div>
          )}
        </div>, document.body)
      )}
    </div>
  );
};

export default SearchableSelect;
