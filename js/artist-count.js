async function showArtistCounts() {
  try {
    const res = await fetch('/songs.json');
    if (!res.ok) throw new Error('songs.json の読み込み失敗');

    const songs = await res.json();
    const counts = {};

    songs.forEach(song => {
      const slug = song.artistSlug;
      if (!slug) return;
      counts[slug] = (counts[slug] || 0) + 1;
    });

document.querySelectorAll('.artist-link[data-artist]').forEach(link => {
  const slug = link.dataset.artist;
  const count = counts[slug] || 0;

  if(count === 0){
    link.classList.add("no-songs");
  }

  const oldBadge = link.querySelector('.artist-count');
  if (oldBadge) oldBadge.remove();

  const badge = document.createElement('span');
  badge.className = 'artist-count' + (count === 0 ? ' zero' : '');
  badge.textContent = count;

  link.appendChild(badge);
});

  } catch (error) {
    console.error('artist-count error:', error);
  }
}

document.addEventListener('DOMContentLoaded', showArtistCounts);

