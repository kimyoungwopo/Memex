import { useState, useRef, useEffect } from "react"
import { ChevronDown } from "lucide-react"
import clsx from "clsx"
import { PERSONAS, type Persona } from "../types"

interface PersonaSelectorProps {
  selectedPersona: Persona
  onSelect: (persona: Persona) => void
  disabled?: boolean
}

export function PersonaSelector({ selectedPersona, onSelect, disabled }: PersonaSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSelect = (persona: Persona) => {
    onSelect(persona)
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={clsx(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all",
          "border border-slate-200 bg-white hover:bg-slate-50",
          disabled && "opacity-50 cursor-not-allowed",
          isOpen && "ring-2 ring-indigo-100 border-indigo-300"
        )}
      >
        <span>{selectedPersona.icon}</span>
        <span className="text-slate-700">{selectedPersona.name}</span>
        <ChevronDown className={clsx(
          "w-3.5 h-3.5 text-slate-400 transition-transform",
          isOpen && "rotate-180"
        )} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1.5 w-56 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="py-1">
            {PERSONAS.map((persona) => (
              <button
                key={persona.id}
                onClick={() => handleSelect(persona)}
                className={clsx(
                  "w-full flex items-start gap-3 px-3 py-2.5 text-left hover:bg-slate-50 transition-colors",
                  selectedPersona.id === persona.id && "bg-indigo-50"
                )}
              >
                <span className="text-lg mt-0.5">{persona.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className={clsx(
                    "text-sm font-medium",
                    selectedPersona.id === persona.id ? "text-indigo-700" : "text-slate-800"
                  )}>
                    {persona.name}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {persona.description}
                  </div>
                </div>
                {selectedPersona.id === persona.id && (
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
