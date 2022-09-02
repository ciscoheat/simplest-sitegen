<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="ie=edge">
  <title>FullOO Home Page</title>
  <link rel="stylesheet" href="/CSS/chota.min.css?glxzhr">
  <link rel="stylesheet" href="/CSS/fulloo.css?1dpkm1x">
  <!-- build:styles -->
</head>
<body>
  <nav class="nav hide-pr" id="tabs">
    <div class="nav-center">
      <a href="/">Home</a>
      <a href="/Introduction/">Introduction</a>
      <a href="/FAQ/">FAQ</a>
      <a href="/Documents/">Documents</a>
      <a href="/Examples/">Examples</a>
      <a href="/Downloads/">Downloads</a>
      <a href="/Events/">Events</a>
      <a href="/oowiki.php">Wiki</a>
    </div>
  </nav>

  <main class="container">
    
<h1>PHP test</h1>
<ul>
<?php foreach(array("A", "B", "C") as $char): ?>
  <li><b><?php echo $char ?>:</b> Php works</li>
<?php endforeach; ?>
</ul>
<img src="img/test.png?1czjh4l">

  </main>
  
  <script src="/js/highlight.min.js"></script>
  <script>
    // Navigation highlight
    const current = document.location.pathname
    document.querySelectorAll('#tabs a').forEach(a => {
      const tab = new URL(a.href).pathname

      if(tab == current) {
        a.classList.add('active')
      }
    })
  </script>    
</body>
</html>
