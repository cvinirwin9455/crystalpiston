import Image from "next/image";

export default function Footer() {
  return (
    <footer className="bg-primary border-t border-white/5 px-6 py-8">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <Image
          src="/IMG_5861.PNG"
          alt="Pistol Performance Coaching"
          width={120}
          height={120}
        />
        <p className="text-gray-500 text-sm">
          &copy; {new Date().getFullYear()} Pistol Performance Coaching. Southwest Missouri.
        </p>
        <a
          href="https://www.facebook.com/people/Pistol-Performance-Coaching/61559962313941/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-400 hover:text-accent transition-colors"
          aria-label="Facebook"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
        </a>
      </div>
    </footer>
  );
}
