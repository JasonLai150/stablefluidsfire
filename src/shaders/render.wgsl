@group(0) @binding(0) var densitySampler: sampler;
@group(0) @binding(1) var densityTexture: texture_2d<f32>;

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
  let positions = array<vec2<f32>, 4>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(1.0, -1.0),
    vec2<f32>(-1.0, 1.0),
    vec2<f32>(1.0, 1.0)
  );
  
  let uv = array<vec2<f32>, 4>(
    vec2<f32>(0.0, 0.0),
    vec2<f32>(1.0, 0.0),
    vec2<f32>(0.0, 1.0),
    vec2<f32>(1.0, 1.0)
  );
  
  var output: VertexOutput;
  output.position = vec4<f32>(positions[vertexIndex], 0.0, 1.0);
  output.uv = uv[vertexIndex];
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
  let density = textureSample(densityTexture, densitySampler, input.uv).x;
  
  // Fire color gradient
  let color = if (density > 0.8) {
    vec3<f32>(1.0, 0.3, 0.1) // Core - bright orange
  } else if (density > 0.5) {
    vec3<f32>(1.0, 0.6, 0.2) // Middle - orange-yellow
  } else if (density > 0.2) {
    vec3<f32>(1.0, 0.9, 0.5) // Outer - yellow
  } else {
    vec3<f32>(0.2, 0.1, 0.0) // Smoke - dark
  };
  
  // Alpha based on density
  let alpha = min(density * 2.0, 1.0);
  
  return vec4<f32>(color * alpha, alpha);
}