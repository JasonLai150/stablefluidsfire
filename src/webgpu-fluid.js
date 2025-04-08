import advectionShader from './shaders/advection.wgsl';
import divergenceShader from './shaders/divergence.wgsl';
import pressureShader from './shaders/pressure.wgsl';
import gradientSubtractShader from './shaders/gradient-subtract.wgsl';
import buoyancyShader from './shaders/buoyancy.wgsl';
import impulseShader from './shaders/impulse.wgsl';
import renderShader from './shaders/render.wgsl';
import clearShader from './shaders/clear.wgsl';

// Configuration
const GPUTextureUsage = window.GPUTextureUsage || {
    COPY_SRC: 0x01,
    COPY_DST: 0x02,
    TEXTURE_BINDING: 0x04,
    STORAGE_BINDING: 0x08,
    RENDER_ATTACHMENT: 0x10
};
  
const SIM_WIDTH = 128;
const SIM_HEIGHT = 256;
const DYE_RESOLUTION = 1024;
const DT = 0.015;
const ITERATIONS = 20;

export async function initCandleSimulation(canvas, width, height) {
  if (!navigator.gpu) {
    throw new Error("WebGPU not supported");
  }

  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();
  
  // Set up canvas context
  const context = canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format,
    alphaMode: 'opaque'
  });
  
  // Create simulation textures
  const createTexture = (usage) => device.createTexture({
    size: [SIM_WIDTH, SIM_HEIGHT, 1],
    usage,
    format: 'rgba16float'
  });
  
  // Velocity field
  const velocityTexture = createTexture(GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING);
  const velocityTexture2 = createTexture(GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING);
  
  // Density (soot) and temperature fields
  const densityTexture = createTexture(GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING);
  const densityTexture2 = createTexture(GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING);
  const temperatureTexture = createTexture(GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING);
  const temperatureTexture2 = createTexture(GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING);
  
  // Divergence and pressure fields
  const divergenceTexture = createTexture(GPUTextureUsage.STORAGE_BINDING);
  const pressureTexture = createTexture(GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING);
  const pressureTexture2 = createTexture(GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING);
  
  // Load shaders
  const shaders = await loadShaders(device);
  
  // Create pipelines
  const pipelines = createPipelines(device, shaders, format);
  
  // Initialize simulation
  await initializeSimulation(device, pipelines, {
    velocityTexture,
    densityTexture,
    temperatureTexture
  });
  
  // Create render pipeline
  const renderPipeline = createRenderPipeline(device, format, shaders.render);
  
  // Main animation loop
  let running = true;
  let lastTime = 0;
  
  function frame(timestamp) {
    if (!running) return;
    
    const deltaTime = Math.min((timestamp - lastTime) / 1000, 0.016);
    lastTime = timestamp;
    
    // Update simulation
    updateSimulation(device, pipelines, {
      velocityTexture,
      velocityTexture2,
      densityTexture,
      densityTexture2,
      temperatureTexture,
      temperatureTexture2,
      divergenceTexture,
      pressureTexture,
      pressureTexture2
    }, deltaTime);
    
    // Render
    render(device, renderPipeline, context, densityTexture, {
      width: canvas.width,
      height: canvas.height
    });
    
    requestAnimationFrame(frame);
  }
  
  return {
    start: () => {
      running = true;
      requestAnimationFrame(frame);
    },
    stop: () => {
      running = false;
    }
  };
}

async function loadShaders(device) {
  // In a real app, you'd load these from separate files
  return {
    advection: advectionShader,
    divergence: divergenceShader,
    pressure: pressureShader,
    gradient: gradientSubtractShader,
    buoyancy: buoyancyShader,
    impulse: impulseShader,
    clear: clearShader,
    render: renderShader
  };
}

function createPipelines(device, shaders, format) {
  // Create all compute pipelines
  return {
    advection: createComputePipeline(device, shaders.advection),
    divergence: createComputePipeline(device, shaders.divergence),
    pressure: createComputePipeline(device, shaders.pressure),
    gradient: createComputePipeline(device, shaders.gradient),
    buoyancy: createComputePipeline(device, shaders.buoyancy),
    impulse: createComputePipeline(device, shaders.impulse),
    clear: createComputePipeline(device, shaders.clear),
  };
}

function createComputePipeline(device, shaderCode) {
  const module = device.createShaderModule({ code: shaderCode });
  return device.createComputePipeline({
    layout: 'auto',
    compute: {
      module,
      entryPoint: 'main'
    }
  });
}

function createRenderPipeline(device, format, shaderCode) {
  const module = device.createShaderModule({ code: shaderCode });
  return device.createRenderPipeline({
    layout: 'auto',
    vertex: {
      module,
      entryPoint: 'vertexMain',
      buffers: []
    },
    fragment: {
      module,
      entryPoint: 'fragmentMain',
      targets: [{ format }]
    },
    primitive: {
      topology: 'triangle-strip'
    }
  });
}

function updateSimulation(device, pipelines, textures, deltaTime) {
    const commandEncoder = device.createCommandEncoder();
    
    // Add buoyancy forces
    {
      const pass = commandEncoder.beginComputePass();
      pass.setPipeline(pipelines.buoyancy);
      pass.setBindGroup(0, createBuoyancyBindGroup(device, pipelines.buoyancy, {
        velocityTexture: textures.velocityTexture,
        temperatureTexture: textures.temperatureTexture,
        densityTexture: textures.densityTexture,
        outputTexture: textures.velocityTexture2
      }));
      pass.dispatchWorkgroups(
        Math.ceil(SIM_WIDTH / 8),
        Math.ceil(SIM_HEIGHT / 8)
      );
      pass.end();
    }
    
    // Add heat/fuel at the base (candle wick)
    {
      const pass = commandEncoder.beginComputePass();
      pass.setPipeline(pipelines.impulse);
      pass.setBindGroup(0, createImpulseBindGroup(device, pipelines.impulse, {
        temperatureTexture: textures.temperatureTexture2,
        densityTexture: textures.densityTexture2
      }));
      pass.dispatchWorkgroups(
        Math.ceil(SIM_WIDTH / 8),
        Math.ceil(SIM_HEIGHT / 8)
      );
      pass.end();
    }
    
    // Advect velocity
    {
      const pass = commandEncoder.beginComputePass();
      pass.setPipeline(pipelines.advection);
      pass.setBindGroup(0, createAdvectionBindGroup(device, pipelines.advection, {
        inputTexture: textures.velocityTexture2,
        outputTexture: textures.velocityTexture
      }));
      pass.dispatchWorkgroups(
        Math.ceil(SIM_WIDTH / 8),
        Math.ceil(SIM_HEIGHT / 8)
      );
      pass.end();
    }
    
    // Calculate divergence
    {
      const pass = commandEncoder.beginComputePass();
      pass.setPipeline(pipelines.divergence);
      pass.setBindGroup(0, createDivergenceBindGroup(device, pipelines.divergence, {
        velocityTexture: textures.velocityTexture,
        divergenceTexture: textures.divergenceTexture
      }));
      pass.dispatchWorkgroups(
        Math.ceil(SIM_WIDTH / 8),
        Math.ceil(SIM_HEIGHT / 8)
      );
      pass.end();
    }
    
    let pressureIn = textures.pressureTexture;
    let pressureOut = textures.pressureTexture2;
    // Solve pressure
    {
      const pass = commandEncoder.beginComputePass();
      pass.setPipeline(pipelines.pressure);
      
      for (let i = 0; i < ITERATIONS; i++) {
        pass.setBindGroup(0, createPressureBindGroup(device, pipelines.pressure, {
          divergenceTexture: textures.divergenceTexture,
          pressureTexture: pressureIn,
          outputTexture: pressureOut
        }));
        pass.dispatchWorkgroups(
          Math.ceil(SIM_WIDTH / 8),
          Math.ceil(SIM_HEIGHT / 8)
        );
        
        // Swap textures for next iteration
        [pressureIn, pressureOut] = [pressureOut, pressureIn];
      }
      pass.end();
    }
    
    // Subtract gradient
    {
      const pass = commandEncoder.beginComputePass();
      pass.setPipeline(pipelines.gradient);
      pass.setBindGroup(0, createGradientBindGroup(device, pipelines.gradient, {
        velocityTexture: textures.velocityTexture,
        pressureTexture: pressureIn,
        outputTexture: textures.velocityTexture2
      }));
      pass.dispatchWorkgroups(
        Math.ceil(SIM_WIDTH / 8),
        Math.ceil(SIM_HEIGHT / 8)
      );
      pass.end();
    }
    
    // Advect temperature and density
    {
      const pass = commandEncoder.beginComputePass();
      pass.setPipeline(pipelines.advection);
      pass.setBindGroup(0, createAdvectionBindGroup(device, pipelines.advection, {
        inputTexture: textures.temperatureTexture2,
        outputTexture: textures.temperatureTexture
      }));
      pass.dispatchWorkgroups(
        Math.ceil(SIM_WIDTH / 8),
        Math.ceil(SIM_HEIGHT / 8)
      );
      pass.end();
    }
    
    {
      const pass = commandEncoder.beginComputePass();
      pass.setPipeline(pipelines.advection);
      pass.setBindGroup(0, createAdvectionBindGroup(device, pipelines.advection, {
        inputTexture: textures.densityTexture2,
        outputTexture: textures.densityTexture
      }));
      pass.dispatchWorkgroups(
        Math.ceil(SIM_WIDTH / 8),
        Math.ceil(SIM_HEIGHT / 8)
      );
      pass.end();
    }
    [textures.densityTexture, textures.densityTexture2] = [textures.densityTexture2, textures.densityTexture];

    
    {
        const pass = commandEncoder.beginComputePass();
        pass.setPipeline(pipelines.advection);
        pass.setBindGroup(0, createAdvectionBindGroup(device, pipelines.advection, {
          inputTexture: textures.densityTexture,
          outputTexture: textures.densityTexture2
        }));
        pass.dispatchWorkgroups(
          Math.ceil(SIM_WIDTH / 8),
          Math.ceil(SIM_HEIGHT / 8)
        );
        pass.end();
      }
    
    device.queue.submit([commandEncoder.finish()]);
  }

  function render(device, pipeline, context, densityTexture, size) {
    const commandEncoder = device.createCommandEncoder();
    
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store'
      }]
    });
    
    renderPass.setPipeline(pipeline);
    renderPass.setBindGroup(0, createRenderBindGroup(device, pipeline, densityTexture));
    renderPass.draw(4, 1, 0, 0);
    renderPass.end();
    
    device.queue.submit([commandEncoder.finish()]);
  }

  function createBuoyancyBindGroup(device, pipeline, { velocityTexture, temperatureTexture, densityTexture, outputTexture }) {
    return device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: velocityTexture.createView() },
        { binding: 1, resource: temperatureTexture.createView() },
        { binding: 2, resource: densityTexture.createView() },
        { binding: 3, resource: outputTexture.createView() }
      ]
    });
  }
  function createImpulseBindGroup(device, pipeline, { temperatureTexture, densityTexture }) {
    return device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: temperatureTexture.createView() },
        { binding: 1, resource: densityTexture.createView() }
      ]
    });
  }
  
  function createAdvectionBindGroup(device, pipeline, { inputTexture, outputTexture }) {
    return device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: inputTexture.createView() },
        { binding: 1, resource: outputTexture.createView() }
      ]
    });
  }
  
  function createDivergenceBindGroup(device, pipeline, { velocityTexture, divergenceTexture }) {
    return device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: velocityTexture.createView() },
        { binding: 1, resource: divergenceTexture.createView() }
      ]
    });
  }
  
  function createPressureBindGroup(device, pipeline, { divergenceTexture, pressureTexture, outputTexture }) {
    return device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: divergenceTexture.createView() },
        { binding: 1, resource: pressureTexture.createView() },
        { binding: 2, resource: outputTexture.createView() }
      ]
    });
  }
  
  function createGradientBindGroup(device, pipeline, { velocityTexture, pressureTexture, outputTexture }) {
    return device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: velocityTexture.createView() },
        { binding: 1, resource: pressureTexture.createView() },
        { binding: 2, resource: outputTexture.createView() }
      ]
    });
  }
  
//   function createDissipationBindGroup(device, pipeline, { inputTexture, outputTexture }) {
//     return device.createBindGroup({
//       layout: pipeline.getBindGroupLayout(0),
//       entries: [
//         { binding: 0, resource: inputTexture.createView() },
//         { binding: 1, resource: outputTexture.createView() }
//       ]
//     });
//   }
  
  function createRenderBindGroup(device, pipeline, densityTexture) {
    const sampler = device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear'
    });
    
    return device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: densityTexture.createView() }
      ]
    });
  }

  async function initializeSimulation(device, pipelines, textures) {
    const commandEncoder = device.createCommandEncoder();

    const clearColorBuffer = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    
    // Clear all textures
    const clearTexture = (texture, color) => {
        const pass = commandEncoder.beginComputePass();
        device.queue.writeBuffer(clearColorBuffer, 0, new Float32Array(color));
        pass.setPipeline(pipelines.clear);
        pass.setBindGroup(0, device.createBindGroup({
          layout: pipelines.clear.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: texture.createView() },
            { binding: 1, resource: { buffer: clearColorBuffer }}
          ]
        }));
        pass.dispatchWorkgroups(
          Math.ceil(SIM_WIDTH / 8),
          Math.ceil(SIM_HEIGHT / 8)
        );
        pass.end();
      };
    
    clearTexture(textures.velocityTexture, [0, 0, 0, 1]);
    clearTexture(textures.densityTexture, [0, 0, 0, 1]);
    clearTexture(textures.temperatureTexture, [0, 0, 0, 1]);
    
    await device.queue.submit([commandEncoder.finish()]);
  }