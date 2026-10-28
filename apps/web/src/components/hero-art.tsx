export function HeroArt() {
  return (
    <div className="hero-art" aria-hidden="true">
      <svg viewBox="0 0 480 270" className="w-full max-w-[440px]" fill="none">
        <path
          d="M60 184C14 113 58 81 89 130C105 31 255-4 267 73C320 38 361 58 325 113C391 133 386 216 299 227L115 224C82 223 68 207 60 184Z"
          fill="#eef8ff"
        />
        <ellipse cx="213" cy="231" rx="140" ry="13" fill="#e4f3ff" />
        <g stroke="#48a3fa" strokeWidth="1.8" strokeLinejoin="round">
          <path d="M141 65H322L304 217H121L141 65Z" fill="white" />
          <path d="M148 72H314L297 208H129L148 72Z" fill="#f3faff" />
          <path
            d="M71 217H326L325 224Q323 229 315 230H83Q73 230 71 217Z"
            fill="white"
          />
          <path d="M187 218H228L225 223H190Z" />
          <path
            d="M205 117L189 132L202 147M245 117L260 132L242 147M234 107L215 158"
            strokeWidth="2"
          />
          <path
            d="M352 139H385L381 170Q368 190 356 171L352 139Z"
            fill="white"
          />
          <path d="M353 144H344Q340 168 357 171M384 144H393Q394 166 381 171M368 181V204M357 207H380M364 204H373M359 145V161" />
          <path
            d="M304 44L347 31L352 47M87 175V185M82 180H92M394 112V122M389 117H399M137 30V40M132 35H142"
            opacity=".55"
          />
        </g>
        <g fill="#80c2fc">
          {Array.from({ length: 25 }, (_, i) => (
            <circle
              key={i}
              cx={77 + (i % 5) * 10}
              cy={47 + Math.floor(i / 5) * 10}
              r="1.2"
            />
          ))}
          <circle cx="62" cy="218" r="2.5" />
          <circle cx="360" cy="226" r="2" />
        </g>
        <text
          x="365"
          y="63"
          fill="#76a9d9"
          fontSize="12"
          fontFamily="Segoe UI, sans-serif"
          fontStyle="italic"
          transform="rotate(-12 365 63)"
        >
          <tspan x="365">Технологии</tspan>
          <tspan x="371" dy="15">
            создают
          </tspan>
          <tspan x="367" dy="15">
            будущее!
          </tspan>
        </text>
        <path d="M385 113Q423 110 435 91" stroke="#8ac5fb" />
      </svg>
    </div>
  );
}
