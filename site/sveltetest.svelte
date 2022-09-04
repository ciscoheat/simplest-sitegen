<script>
	export const title = "Svelte test";
	let m = { x: 0, y: 0 };

	function handleMousemove(event) {
		m.x = event.clientX;
		m.y = event.clientY;
	}
</script>

<h2>{title}</h2>

<div class="box" on:mousemove={handleMousemove}>
	<div class="text">The mouse is at {m.x} x {m.y}</div>
</div>

<style>
	.box { 
		width: 100%; height: 400px; 
		background-color: aquamarine;
	}

	.box .text {
		font-style: italic;
	}
</style>