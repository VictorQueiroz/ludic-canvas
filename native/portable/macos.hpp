#pragma once
#include "engine.hpp"
#include "renderer.hpp"
#include "include/gpu/ganesh/GrDirectContext.h"
#import <AppKit/AppKit.h>
#import <Metal/Metal.h>

using namespace lc;
@class LCView;

@interface LCElement : NSAccessibilityElement
@property(nonatomic, weak) LCView *owner;
@property(nonatomic, strong) NSDictionary *nodeInfo;
@end

@interface LCView : NSView <NSTextFieldDelegate, NSTextViewDelegate> {
@public
  Engine *engine;
  std::shared_ptr<jsi::Function> listener;
  std::unique_ptr<SkiaRenderer> renderer;
  sk_sp<GrDirectContext> context;
  std::vector<float> commands;
  std::vector<uint32_t> resources;
  std::unordered_map<uint32_t, sk_sp<SkImage>> images;
  uint32_t nextImage;
  double frameTime;
  float logicalWidth, logicalHeight;
}
@property(nonatomic, strong) id<MTLDevice> device;
@property(nonatomic, strong) id<MTLCommandQueue> queue;
@property(nonatomic, strong) NSMutableDictionary<NSNumber *, LCElement *> *elements;
@property(nonatomic, strong) NSMutableDictionary<NSNumber *, NSView *> *editors;
@property(nonatomic, strong) NSArray<NSDictionary *> *semantics;
@property(nonatomic, strong) NSTrackingArea *tracking;
@property(nonatomic) NSInteger focusedKey;
@property(nonatomic) BOOL syncing;
- (BOOL)emit:(NSDictionary *)event;
- (void)present;
- (void)sync:(NSArray *)nodes;
- (BOOL)focusKey:(NSInteger)key;
- (void)editChanged:(id)sender;
- (void)dispose;
@end

@interface LCDelegate : NSObject <NSApplicationDelegate, NSWindowDelegate>
@property(nonatomic) Engine *engine;
@property(nonatomic) BOOL terminating;
@end
