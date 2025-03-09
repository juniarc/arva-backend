from flask import jsonify, request, Blueprint
from models.products import Product
from models.shops import Shop
from models.category import Category
from models.variant import Variant
from models.image_product import ImageProduct
from models.tag_product import TagProductAssociation
from models.discount import Discount
from models.rating import Rating
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from sqlalchemy.exc import SQLAlchemyError
from connector.db import db
import datetime
import logging

logging.basicConfig(level=logging.INFO)


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
            description=data['description'],
            product_type=data['product_type'],
            shipping_cost=data['shipping_cost'],
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
        discounts = db.session.query(Discount).filter_by(product_id=product.product_id).all()
        ratings = db.session.query(db.func.avg(Rating.rating_product)).filter_by(product_id=product.product_id).scalar()


        variants = []
        images = []
        tags = []
        discount_list =[]

        for discount in discounts:
            discount_list.append(discount.to_dict())
        

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
                    'variant_stock': v.stock,
                    'variant_unit': v.unit
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
            'ratings': ratings,
            'discount': discount_list,
            # 'shop':{'shop_id':shop_id,'shop_address_city':shop_address_city},
            'shop':shop.to_dict()
            }), 200
    except Exception as e:
        return jsonify({'error': f'Failed to get request product {e}'}), 500



@product_bp.route('/getreqallproduct', methods=['GET'])
def get_request_allproduct():
    
    try:
        products = db.session.query(Product).filter_by(status='active').all()
        product_list = []

        for product in products:
            category_name = product.category.category_name
            variant = db.session.query(Variant).filter_by(product_id=product.product_id).all()
            image_product = db.session.query(ImageProduct).filter_by(product_id=product.product_id).all()
            shop_id = product.shop.shop_id
            shop_address_city = product.shop.shop_address_city
            discounts = db.session.query(Discount).filter_by(product_id=product.product_id).all()
            ratings = db.session.query(db.func.avg(Rating.rating_product)).filter_by(product_id=product.product_id).scalar()
           
            discount_list =[]
            variants = []
            images = []
            tags = []

            for discount in discounts:
                discount_list.append(discount.to_dict())

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
                        'variant_stock': v.stock,
                        'variant_unit': v.unit
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
                'discount': discount_list,
                'ratings': ratings,
                'shop':{'shop_id':shop_id,'shop_address_city':shop_address_city, 'shop_name':product.shop.shop_name},
            })

        return jsonify( product_list), 200
    except Exception as e:
        return jsonify({'error': f'Failed to get request product {e}'}), 500

        
# get product by category
@product_bp.route('/getproductbycategory/<int:category_id>', methods=['GET'])
def get_product_by_category(category_id):
    try:
        products = db.session.query(Product).filter_by(category_id=category_id, status='active').all()
        product_list = []

        for product in products:
            category_name = product.category.category_name
            variant = db.session.query(Variant).filter_by(product_id=product.product_id).all()
            image_product = db.session.query(ImageProduct).filter_by(product_id=product.product_id).all()
            shop_id = product.shop.shop_id
            shop_address_city = product.shop.shop_address_city
            discounts = db.session.query(Discount).filter_by(product_id=product.product_id).all()
            ratings = db.session.query(db.func.avg(Rating.rating_product)).filter_by(product_id=product.product_id).scalar()
           
            discount_list =[]
            variants = []
            images = []
            tags = []

            for discount in discounts:
                discount_list.append(discount.to_dict())

            if image_product:
                for image in image_product:
                    image = {
                        'image_id': image.image_id,
                        'image_data': image.image_data
                    }
                    image = image.image_data
                    images.append(image)
            
            if variant:
                for v in variant:
                    v = {
                        'variant_id': v.variant_id,
                        'variant_name': v.variant_name,
                        'variant_price': v.price,
                        'variant_stock': v.stock,
                        'variant_unit': v.unit
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
                'discount': discount_list,
                'ratings': ratings,
                'shop':{'shop_id':shop_id,'shop_address_city':shop_address_city, 'shop_name':product.shop.shop_name},
            })

        return jsonify( product_list), 200
    except Exception as e:
        return jsonify({'error': f'Failed to get request product {e}'}), 500
    

#get product by shop
@product_bp.route('/getproductbyseller/<int:shop_id>', methods=['GET'])
def get_product_by_shop(shop_id):
    try:
        products = db.session.query(Product).filter_by(shop_id=shop_id, status='active').all()
        product_list = []

        for product in products:
            category_name = product.category.category_name
            variant = db.session.query(Variant).filter_by(product_id=product.product_id).all()
            image_product = db.session.query(ImageProduct).filter_by(product_id=product.product_id).all()
            shop_id = product.shop.shop_id
            shop_address_city = product.shop.shop_address_city
            discounts = db.session.query(Discount).filter_by(product_id=product.product_id).all()
            ratings = db.session.query(db.func.avg(Rating.rating_product)).filter_by(product_id=product.product_id).scalar()
           
            discount_list =[]
            variants = []
            images = []
            tags = []

            for discount in discounts:
                discount_list.append(discount.to_dict())

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
                        'variant_stock': v.stock,
                        'variant_unit': v.unit
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
                'ratings': ratings,
                'discount': discount_list,
                'shop':{'shop_id':shop_id,'shop_address_city':shop_address_city, 'shop_name':product.shop.shop_name},
            })

        return jsonify( product_list), 200
    except Exception as e:
        return jsonify({'error': f'Failed to get request product {e}'}), 500    


# create product, image, variant

@product_bp.route('/createnewproduct', methods=['POST'])
@jwt_required()
def create_new_product():
    data = request.json
    current_user_id = int(get_jwt_identity())
    requiered_fields = ['product_name', 'description', 'category_id','shipping_cost', 'product_type', 'variants']

    for field in requiered_fields:
        if field not in data:
            return jsonify({"error": f"Missing field: {field}"}), 400
        elif not data[field] or str(data[field]).strip() == "":
            return jsonify({"error": f"{field} cannot be empty"}), 400



    try:
        shop = db.session.query(Shop).filter_by(user_id=current_user_id).first()

        if shop is None:
            return jsonify({"error": "Shop not found"}), 400


        # Ambil data produk dari request
        product_name = data.get('product_name')
        description = data.get('description')
        category_id = data.get('category_id')
        product_type = data.get('product_type')
        shipping_cost = data.get('shipping_cost', 0)
        product_shop_id = shop.shop_id



        # Buat instance produk baru
        product = Product(
            product_name=product_name,
            description=description,
            category_id=category_id,
            product_type=product_type,
            shipping_cost=shipping_cost,
            shop_id=product_shop_id
        )
        db.session.add(product)
        db.session.flush()  # Mendapatkan product_id sebelum commit
        print(f"Generated Product ID: {product.product_id}")

        # Tambahkan gambar jika ada
        images = data.get('images', [])
        for image_data in images:
            image_product = ImageProduct(
                image_data=image_data,
                product_id=product.product_id
            )
            db.session.add(image_product)

        # Tambahkan varian jika ada
        variants = data.get('variants', [])
        for variant in variants:
            variant_name = variant.get('variant_name')
            price = variant.get('price')
            stock = variant.get('stock', 0)
            unit = variant.get('unit', 'kg')

            if not variant_name or price is None:
                return jsonify({"error": "Each variant must have variant_name and price."}), 400

            product_variant = Variant(
                variant_name=variant_name,
                price=price,
                stock=stock,
                unit=unit,
                product_id=product.product_id
            )
            db.session.add(product_variant)

        # Commit semua perubahan ke database
        db.session.commit()

        return jsonify({
            "message": "Product created successfully",
            "product_id": product.product_id
        }), 201

    except SQLAlchemyError as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500



@product_bp.route('/searchproduct/<string:product_name>', methods=['GET'])
def search_product_by_name(product_name):
    try:
        product_name.lower()
        products = db.session.query(Product).filter(Product.product_name.ilike(f'%{product_name}%')).all()
        product_list = []

        for product in products:
            category_name = product.category.category_name
            variant = db.session.query(Variant).filter_by(product_id=product.product_id).all()
            image_product = db.session.query(ImageProduct).filter_by(product_id=product.product_id).all()
            shop_id = product.shop.shop_id
            shop_address_city = product.shop.shop_address_city
            shop_name = product.shop.shop_name
            discounts = db.session.query(Discount).filter_by(product_id=product.product_id).all()
           
            discount_list =[]
            variants = []
            images = []
            tags = []

            for discount in discounts:
                discount_list.append(discount.to_dict())

            if image_product:
                for image in image_product:
                    # image = {
                    #     'image_id': image.image_id,
                    #     'image_data': image.image_data
                    # }
                    image = image.image_data
                    images.append(image)
            
            if variant:
                for var in variant:
                    variants.append(var.to_dict())

            product_list.append({
                'product_id': product.product_id,
                'product_name': product.product_name,
                'description': product.description,
                'category_id': product.category_id,
                'category_name': category_name,
                'product_type': product.product_type,
                'shipping_cost': product.shipping_cost,
                'shop_address_city': shop_address_city,
                'variants': variants,
                'images': images,
                'discounts': discount_list,
                'shop': {
                    'shop_id': shop_id,
                    'shop_name': shop_name,
                    'shop_address_city': shop_address_city},
                'tags': tags
            })

        return jsonify(product_list), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": f'Failed to get products {e}'}), 500





@product_bp.route('/getreqlimitallproduct/<int:limit>', methods=['GET'])
def get_request_allproduct_limit(limit):
    
    try:
        products = db.session.query(Product).filter_by(status='active').limit(limit).all()
        product_list = []

        for product in products:
            category_name = product.category.category_name
            variant = db.session.query(Variant).filter_by(product_id=product.product_id).all()
            image_product = db.session.query(ImageProduct).filter_by(product_id=product.product_id).all()
            shop_id = product.shop.shop_id
            shop_address_city = product.shop.shop_address_city
            discounts = db.session.query(Discount).filter_by(product_id=product.product_id).all()
            ratings = db.session.query(db.func.avg(Rating.rating_product)).filter_by(product_id=product.product_id).scalar()
           
            discount_list =[]
            variants = []
            images = []
            tags = []

            for discount in discounts:
                discount_list.append(discount.to_dict())

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
                        'variant_stock': v.stock,
                        'variant_unit': v.unit
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
                'discount': discount_list,
                'ratings': ratings,
                'shop':{'shop_id':shop_id,'shop_address_city':shop_address_city, 'shop_name':product.shop.shop_name},
            })

        return jsonify( product_list), 200
    except Exception as e:
        return jsonify({'error': f'Failed to get request product {e}'}), 500