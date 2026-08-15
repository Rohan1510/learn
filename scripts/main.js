document.addEventListener('DOMContentLoaded', () => {
  const greetings = [
    { title: 'Hello, World!', text: 'Welcome to modern HTML5 & CSS3 web development.' },
    { title: 'Bonjour le Monde!', text: 'Crafting clean, semantic, and interactive user experiences.' },
    { title: '¡Hola Mundo!', text: 'Styled with modern CSS variables, layout, and animations.' },
    { title: 'Hallo Welt!', text: 'Built cleanly with separate structure, style, and behavior.' },
    { title: 'Ciao Mondo!', text: 'Ready for full-stack, scalable application development.' }
  ];

  let currentIndex = 0;

  const titleElement = document.getElementById('main-heading');
  const subtitleElement = document.getElementById('sub-heading');
  const buttonElement = document.getElementById('interactive-btn');
  const statusElement = document.getElementById('status-msg');

  if (buttonElement && titleElement && subtitleElement) {
    buttonElement.addEventListener('click', () => {
      currentIndex = (currentIndex + 1) % greetings.length;
      
      // Animate text change
      titleElement.style.opacity = '0';
      subtitleElement.style.opacity = '0';
      
      setTimeout(() => {
        titleElement.textContent = greetings[currentIndex].title;
        subtitleElement.textContent = greetings[currentIndex].text;
        titleElement.style.opacity = '1';
        subtitleElement.style.opacity = '1';
      }, 150);

      if (statusElement) {
        statusElement.textContent = `Language switched (${currentIndex + 1}/${greetings.length})`;
      }
    });
  }
});
