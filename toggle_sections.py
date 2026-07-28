import re

with open("iama/index.html", "r") as f:
    html = f.read()

# Find the split point: <section id="detalhes"
split_index = html.find('<section class="section-padding group-vip-section')

top_part = html[:split_index]
bottom_part = html[split_index:]

# In bottom part, swap bg-light-layer and bg-dark-layer
bottom_part = bottom_part.replace('bg-light-layer', 'TEMP_LAYER')
bottom_part = bottom_part.replace('bg-dark-layer', 'bg-light-layer')
bottom_part = bottom_part.replace('TEMP_LAYER', 'bg-dark-layer')

# We need to remove some inline styles from bottom_part that enforce light-theme colors
# style="color: var(--color-brand-dark);"
bottom_part = re.sub(r'\s*style="[^"]*color:\s*var\(--color-brand-dark\);[^"]*"', '', bottom_part)
bottom_part = re.sub(r'\s*style="[^"]*color:\s*#000d14;[^"]*"', '', bottom_part)
# Also styles on detail-card glassmorphism
bottom_part = re.sub(r'\s*style="[^"]*background:\s*#fff;[^"]*"', '', bottom_part)

with open("iama/index.html", "w") as f:
    f.write(top_part + bottom_part)

print("Done")
