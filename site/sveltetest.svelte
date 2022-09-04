<script>
	export const title = "Svelte test";
	let m = { x: 0, y: 0 };

	function handleMousemove(event) {
		m.x = event.clientX;
		m.y = event.clientY;
	}
</script>

<h2>{title}</h2>

<div on:mousemove={handleMousemove}>
	<div class="text">The mouse is at {m.x} x {m.y}</div>
</div>

<style>
	div { 
		width: 100%; height: 400px; 
		background-color: aquamarine;
	}

	div .text {
		font-style: italic;
	}
</style>