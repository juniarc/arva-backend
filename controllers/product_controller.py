from flask import jsonify, request, Blueprint
from models.products import Product
from models.shops import Shop
from models.category import Category
from models.variant import Variant
from models.image_product import ImageProduct
from models.tag_product import TagProductAssociation
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from connector.db import db
import datetime


product_bp = Blueprint('product_controller', __name__)

@product_bp.route('/<int:product_id>', methods=['GET'])
def get_products(product_id):
    
    try:
        products = db.session.query(Product).filter_by(product_id=product_id).first()
        if products is None:
            return jsonify({'error': 'Product not found'}), 404
        return jsonify(products.to_dict()), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get product'}), 500
    

@product_bp.route('/allproducts', methods=['GET'])
def get_all_products():
    try:
        products = db.session.query(Product).all()
        return jsonify([product.to_dict() for product in products]), 200
    except Exception as e:
        return jsonify({'error': 'Failed to get all products'}), 500


@product_bp.route('/createproduct', methods=['POST'])
@jwt_required()
def create_product():
    data = request.get_json()
    current_user_id = int(get_jwt_identity())
    require_fields= ['product_name', 'description', 'category_id', 'product_type', 'shipping_cost']

    if data is None:
        return jsonify({'error': 'No data provided'}), 400
    
    for field in require_fields:
        if field not in data:
            return jsonify({'error': f'Missing field: {field}'}), 400
        elif not data[field] or str(data[field]).strip() == "":
            return jsonify({'error': f'{field} cannot be empty'}), 400
    
    try:
        shop = db.session.query(Shop).filter_by(user_id=current_user_id).first()
        category = db.session.query(Category).filter_by(category_id=data['category_id']).first()

        if shop is None:
            return jsonify({'error': 'Shop not found'}), 404
        elif category is None:
            return jsonify({'error': 'Category not found'}), 404
        new_product = Product(
            product_name=data['product_name'],
            category_id=data['category_id'],
            shop_id=shop.shop_id
        )
        db.session.add(new_product)
        db.session.commit()
        return jsonify({'message': 'Product created successfully'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to create product'}), 500
    

@product_bp.route('/<int:product_id>', methods=['PUT'])
@jwt_required()
def update_product(product_id):
    data = request.get_json()
    current_user_id = int(get_jwt_identity())

    if data is None:
        return jsonify({'error': 'No data provided'}), 400
    
    try:
        product = db.session.query(Product).filter_by(product_id=product_id).first()
        if product is None:
            return jsonify({'error': 'Product not found'}), 404
        if product.shop.user_id != current_user_id:
            return jsonify({'error': 'Unauthorized: Insufficient permissions'}), 401
        product.product_name = data.get('product_name', product.product_name)
        product.description = data.get('description', product.description)  
        product.product_type = data.get('product_type', product.product_type)
        product.shipping_cost = data.get('shipping_cost', product.shipping_cost)
        product.category_id = data.get('category_id', product.category_id)
        db.session.commit()
        return jsonify({'message': 'Product updated successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to update product'}), 500
    

@product_bp.route('/<int:product_id>/deactivate', methods=['PUT'])
@jwt_required()
def deactivate_product(product_id):
    data = request.get_json()
    current_user_id = int(get_jwt_identity())

    if data is None:
        return jsonify({'error': 'No data provided'}), 400
    if 'status' not in data:
        return jsonify({'error': 'Missing status'}), 400
    
    try:
        product = db.session.query(Product).filter_by(product_id=product_id).first()
        if product is None:
            return jsonify({'error': 'Product not found'}), 404
        if product.shop.user_id != current_user_id:
            return jsonify({'error': 'Unauthorized: Insufficient permissions'}), 401
        product.status = data['status']
        db.session.commit()
        return jsonify({'message': 'Product deactivated successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to deactivate product'}), 500
    
@product_bp.route('/getreqproductdetail/<int:product_id>', methods=['GET'])
def get_request_product(product_id):

    try:
        product = db.session.query(Product).filter_by(product_id=product_id).first()
        category_name = db.session.query(Category).filter_by(category_id=product.category_id).first().category_name
        variant = db.session.query(Variant).filter_by(product_id=product_id).all()
        image_product = db.session.query(ImageProduct).filter_by(product_id=product_id).all()
        shop_id = product.shop.shop_id
        shop_address_city = product.shop.shop_address_city
        tag_product = db.session.query(TagProductAssociation).filter_by(product_id=product_id).all()
        shop = product.shop

        variants = []
        images = []
        tags = []

        if image_product:
            for image in image_product:
                image = {
                    'image_id': image.image_id,
                    'image_data': image.image_data
                }
                # image = image.image_data
                images.append(image)
        
        if variant:
            for v in variant:
                v = {
                    'variant_id': v.variant_id,
                    'variant_name': v.variant_name,
                    'variant_price': v.price,
                    'variant_stock': v.stock
                }
                variants.append(v)

        if tag_product:
            for tag in tag_product:
                tag = tag.tag.tag_name               
                tags.append(tag)

        return jsonify({
            'product_id': product.product_id,
            'product_name': product.product_name,
            'description': product.description,
            'product_type': product.product_type,
            'shipping_cost': product.shipping_cost,
            'created_at': product.created_at,
            'sold': product.sold,
            'status': product.status,
            'category': category_name,
            'image': images,
            'variant': variants,
            'tag': tags,
            # 'shop':{'shop_id':shop_id,'shop_address_city':shop_address_city},
            'shop':shop.to_dict()
            }), 200
    except Exception as e:
        return jsonify({'error': f'Failed to get request product {e}'}), 500



@product_bp.route('/getreqallproduct', methods=['GET'])
def get_request_allproduct():
    
    try:
        products = db.session.query(Product).all()
        product_list = []

        for product in products:
            category_name = product.category.category_name
            variant = db.session.query(Variant).filter_by(product_id=product.product_id).all()
            image_product = db.session.query(ImageProduct).filter_by(product_id=product.product_id).all()
            shop_id = product.shop.shop_id
            shop_address_city = product.shop.shop_address_city
           

            variants = []
            images = []
            tags = []
            if image_product:
                for image in image_product:
                    # image = {
                    #     'image_id': image.image_id,
                    #     'image_data': image.image_data
                    # }
                    image = image.image_data
                    images.append(image)
            
            if variant:
                for v in variant:
                    v = {
                        'variant_id': v.variant_id,
                        'variant_name': v.variant_name,
                        'variant_price': v.price,
                        'variant_stock': v.stock
                    }
                    variants.append(v)

            product_list.append({
                'product_id': product.product_id,
                'product_name': product.product_name,
                'description': product.description,
                'product_type': product.product_type,
                'shipping_cost': product.shipping_cost,
                'sold': product.sold,
                'created_at': product.created_at,
                'status': product.status,
                'category': category_name,
                'image': images,
                'variant': variants, 
                'shop':{'shop_id':shop_id,'shop_address_city':shop_address_city},
            })

        return jsonify( product_list), 200
    except Exception as e:
        return jsonify({'error': f'Failed to get request product {e}'}), 500

        

